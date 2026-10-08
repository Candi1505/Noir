import {sanitiseRecords} from './sanitise.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Content-Type':'application/json'};
// Public GET is intentional: the owner requested login-free shared chest data.
// Privileged database access stays on the server; the response is allowlisted.
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='GET')return new Response(JSON.stringify({error:'Read only'}),{status:405,headers});
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw Error('Unavailable');
  const response=await fetch(`${url}/rest/v1/predictors?select=chest_type,version,uploaded_at,active,predictor_data&active=eq.true&order=uploaded_at.desc&limit=12`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)throw Error('Unavailable');
  const records=sanitiseRecords(await response.json());
  return new Response(JSON.stringify({records}),{headers:{...headers,'Cache-Control':'public, max-age=60'}});
 }catch(_){return new Response(JSON.stringify({error:'Shared event data temporarily unavailable'}),{status:503,headers});}
});
