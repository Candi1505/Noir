/* =========================================================
   CHEST COMPANION V2
   Database and Authentication

   
========================================================= */

window.ChestDatabase = {

  /*
    Gets the current Supabase session.

    If the player has never opened Chest Companion before,
    an anonymous account is automatically created.
  */

  async getOrCreateSession() {

    const supabaseClient =
      window.chestSupabase;


    if (!supabaseClient) {

      throw new Error(
        "Supabase client is unavailable."
      );

    }


    const {
      data: sessionData,
      error: sessionError
    } =
      await supabaseClient.auth.getSession();


    if (sessionError) {

      throw sessionError;

    }


    if (sessionData.session) {

      return sessionData.session;

    }


    const {
      data: anonymousData,
      error: anonymousError
    } =
      await supabaseClient.auth
        .signInAnonymously();


    if (anonymousError) {

      throw anonymousError;

    }


    if (!anonymousData.session) {

      throw new Error(
        "Anonymous sign-in did not create a session."
      );

    }


    return anonymousData.session;

  },


  /*
    Reads the player's profile.

    If a profile does not exist yet,
    Chest Companion creates one automatically.
  */

  async getOrCreateProfile(user) {

    const supabaseClient =
      window.chestSupabase;


    const {
      data: existingProfile,
      error: readError
    } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();


    if (readError) {

      throw readError;

    }


    if (existingProfile) {

      await supabaseClient
        .from("profiles")
        .update({
          last_active_at:
            new Date().toISOString()
        })
        .eq("id", user.id);


      return existingProfile;

    }


    const newProfile = {

      id: user.id,

      nickname: "Tester",

      alliance_name: null,

      avatar_url: null,

      preferred_theme:
        "crystal_storm",

      favourite_chest: null,

      last_active_at:
        new Date().toISOString()

    };


    const {
      data: createdProfile,
      error: createError
    } =
      await supabaseClient
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();


    if (createError) {

      throw createError;

    }


    return createdProfile;

  },


  /*
    Starts Chest Companion's cloud connection.

    This returns:

    - the anonymous Supabase user
    - the player's profile
  */

  async initialisePlayer() {

    const session =
      await this.getOrCreateSession();


    const user =
      session.user;


    if (!user) {

      throw new Error(
        "No authenticated player was found."
      );

    }


    const profile =
      await this.getOrCreateProfile(user);


    return {

      session,

      user,

      profile

    };

  },


  /*
    Saves nickname, alliance and favourite chest.
  */

  async saveProfile(
    userId,
    profileDetails
  ) {

    const supabaseClient =
      window.chestSupabase;


    const profileUpdate = {

      nickname:
        profileDetails.nickname ||
        "Tester",

      alliance_name:
        profileDetails.alliance_name ||
        null,

      favourite_chest:
        profileDetails.favourite_chest ||
        null,

      last_active_at:
        new Date().toISOString()

    };


    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId)
        .select()
        .single();


    if (error) {

      throw error;

    }


    return data;

  }
  async getPredictor(chestType) {

  const supabaseClient =
    window.chestSupabase;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("predictors")
      .select("*")
      .eq("chest_type", chestType)
      .eq("active", true)
      .maybeSingle();

  if (error) {

    throw error;

  }

  return data;

}
async savePredictor({
  chestType,
  version,
  predictorData,
  uploadedBy = null
}) {
  const supabaseClient = window.chestSupabase;

  if (!supabaseClient) {
    throw new Error(
      "Supabase is not connected."
    );
  }

  const normalisedChestType = String(
    chestType || ""
  )
    .trim()
    .toLowerCase();

  if (
    !["gold", "platinum", "draconic"].includes(
      normalisedChestType
    )
  ) {
    throw new Error(
      "Unsupported chest type."
    );
  }

  if (
    !predictorData ||
    typeof predictorData !== "object"
  ) {
    throw new Error(
      "Predictor data is missing or invalid."
    );
  }

  /*
   * First deactivate the currently active
   * predictor for this chest type.
   */
  const {
    error: deactivateError
  } = await supabaseClient
    .from("predictors")
    .update({
      active: false
    })
    .eq(
      "chest_type",
      normalisedChestType
    )
    .eq("active", true);

  if (deactivateError) {
    throw deactivateError;
  }

  /*
   * Then upload the replacement and mark
   * it as the active predictor.
   */
  const {
    data,
    error
  } = await supabaseClient
    .from("predictors")
    .insert({
      chest_type: normalisedChestType,
      version:
        version ||
        new Date().toISOString(),
      predictor_data: predictorData,
      active: true,
      uploaded_by: uploadedBy
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
},

async getActivePredictors() {
  const supabaseClient =
    window.chestSupabase;

  if (!supabaseClient) {
    throw new Error(
      "Supabase is not connected."
    );
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("predictors")
    .select(
      [
        "id",
        "chest_type",
        "version",
        "predictor_data",
        "uploaded_at"
      ].join(",")
    )
    .eq("active", true)
    .order(
      "uploaded_at",
      {
        ascending: false
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
},

};


console.log(
  "Chest Companion: Database tools loaded."
);