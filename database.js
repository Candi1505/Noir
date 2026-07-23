/* =========================================================
   CHEST COMPANION V2
   Database and Authentication

   
========================================================= */

window.ChestDatabase = {

  isAdminProfile(profile) {
    return Boolean(
      profile &&
      (
        profile.is_admin === true ||
        String(profile.role || "")
          .toLowerCase() === "admin"
      )
    );
  },

  async getCurrentAccess() {
    const supabaseClient =
      window.chestSupabase;

    if (!supabaseClient) {
      throw new Error(
        "Supabase is not connected."
      );
    }

    const { data, error } =
      await supabaseClient.auth
        .getSession();

    if (error) {
      throw error;
    }

    const user =
      data.session?.user || null;

    if (!user) {
      return {
        user: null,
        profile: null,
        isAdmin: false
      };
    }

    const {
      data: profile,
      error: profileError
    } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    return {
      user,
      profile,
      isAdmin:
        this.isAdminProfile(profile)
    };
  },

  async signInAdmin(email, password) {
    const access =
      await this.signInMember(
        email,
        password
      );

    if (!access.isAdmin) {
      await window.chestSupabase.auth
        .signOut();

      throw new Error(
        "This account does not have Noir administrator access."
      );
    }

    return access;
  },

  async signInMember(email, password) {
    const supabaseClient =
      window.chestSupabase;

    const {
      data,
      error
    } = await supabaseClient.auth
      .signInWithPassword({
        email: String(email || "").trim(),
        password: String(password || "")
      });

    if (error) {
      throw error;
    }

    if (data.user) {
      await this.getOrCreateProfile(
        data.user
      );
    }

    return this.getCurrentAccess();
  },

  async signUpMember(email, password, nickname = "") {
    const cleanEmail =
      String(email || "").trim();
    const cleanPassword =
      String(password || "");
    const cleanNickname =
      String(nickname || "")
        .trim()
        .slice(0, 30);

    if (!cleanEmail) {
      throw new Error("Enter your email address.");
    }

    if (cleanPassword.length < 8) {
      throw new Error(
        "Use a password with at least 8 characters."
      );
    }

    const { data, error } =
      await window.chestSupabase.auth
        .signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            emailRedirectTo:
              window.location.href
                .split("#")[0]
                .split("?")[0],
            data: {
              nickname:
                cleanNickname || "Player"
            }
          }
        });

    if (error) throw error;

    if (data.user && data.session) {
      await this.getOrCreateProfile(data.user);
    }

    return {
      user: data.user || null,
      session: data.session || null,
      confirmationRequired:
        Boolean(data.user && !data.session)
    };
  },

  async sendPasswordReset(email) {
    const cleanEmail =
      String(email || "").trim();

    if (!cleanEmail) {
      throw new Error("Enter your email address first.");
    }

    const { error } =
      await window.chestSupabase.auth
        .resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              window.location.href
                .split("#")[0]
                .split("?")[0]
          }
        );

    if (error) throw error;
    return true;
  },

  async updateMemberPassword(password) {
    const cleanPassword =
      String(password || "");

    if (cleanPassword.length < 8) {
      throw new Error(
        "Use a password with at least 8 characters."
      );
    }

    const { error } =
      await window.chestSupabase.auth
        .updateUser({
          password: cleanPassword
        });

    if (error) throw error;
    return true;
  },

  async signOutAdmin() {
    const { error } =
      await window.chestSupabase.auth
        .signOut();

    if (error) {
      throw error;
    }

    return true;
  },

  /*
    Gets the current Supabase session.

    Chest Companion never creates anonymous accounts. A player
    must explicitly sign in or create an email-confirmed account.
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


    return null;

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
        .eq("user_id", user.id)
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
        .eq("user_id", user.id);


      return existingProfile;

    }


    const newProfile = {

      user_id: user.id,

      nickname:
        String(
          user.user_metadata?.nickname ||
          "Player"
        )
          .trim()
          .slice(0, 30) || "Player",

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
      session?.user || null;


    if (!user) {

      return {
        session: null,
        user: null,
        profile: null
      };

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
        .eq("user_id", userId)
        .select()
        .single();


    if (error) {

      throw error;

    }


    return data;

  },
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

},
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
  ![
    "gold",
    "platinum",
    "draconic",
    "freedom"
  ].includes(
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

  const safeVersion =
    version ||
    Math.floor(Date.now() / 1000);

  const {
    data,
    error
  } = await supabaseClient
    .rpc(
      "publish_noir_predictor",
      {
        p_chest_type:
          normalisedChestType,
        p_version:
          safeVersion,
        p_predictor_data:
          predictorData
      }
    );

  if (!error) {
    return Array.isArray(data)
      ? data[0]
      : data;
  }

  /*
   * Older Noir projects were deployed before the atomic
   * publish_noir_predictor RPC was added. Keep cloud publishing
   * functional by falling back to the same RLS-protected table
   * operations. Supabase still verifies administrator access
   * through the predictors policies.
   */
  const rpcUnavailable =
    error.code === "PGRST202" ||
    /publish_noir_predictor|schema cache|function/i
      .test(String(error.message || ""));

  if (!rpcUnavailable) {
    throw error;
  }

  const access =
    await this.getCurrentAccess();

  if (!access.isAdmin || !access.user) {
    throw new Error(
      "Administrator access is required to publish predictor data."
    );
  }

  const {
    error: deactivateError
  } = await supabaseClient
    .from("predictors")
    .update({ active: false })
    .eq(
      "chest_type",
      normalisedChestType
    )
    .eq("active", true);

  if (deactivateError) {
    throw deactivateError;
  }

  const {
    data: inserted,
    error: insertError
  } = await supabaseClient
    .from("predictors")
    .insert({
      chest_type:
        normalisedChestType,
      version:
        safeVersion,
      predictor_data:
        predictorData,
      uploaded_by:
        access.user.id,
      uploaded_at:
        new Date().toISOString(),
      active: true
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
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

async publishLiveEvent(
  eventData,
  sourceFile = null
) {
  const access =
    await this.getCurrentAccess();

  if (!access.isAdmin) {
    throw new Error(
      "Administrator access is required to publish event data."
    );
  }

  if (
    !eventData?.chests ||
    typeof eventData.chests !== "object"
  ) {
    throw new Error(
      "The uploaded event data did not contain usable chest decks."
    );
  }

  const publishedAt =
    new Date().toISOString();

  const version =
    Math.floor(Date.now() / 1000);

  const sanitisedEvent = {
    schema: "noir-live-event-v1",
    event: eventData.event || "Current event",
    importedAt:
      eventData.importedAt ||
      publishedAt,
    publishedAt,
    ready: Boolean(eventData.ready),
    readyChestCount:
      Number(eventData.readyChestCount) || 0,
    chests: eventData.chests,
    decks: eventData.decks || {},
    drops: eventData.drops || {},
    deckIndices:
      eventData.deckIndices || {},
    spinTypes:
      eventData.spinTypes || [],
    doubleArmory:
      eventData.doubleArmory || {
        detected: false,
        ready: false,
        sides: {}
      }
  };

  const chestTypes = [
    "gold",
    "platinum",
    "draconic",
    "freedom"
  ].filter(
    chestType =>
      sanitisedEvent.chests[
        chestType
      ]?.found
  );

  if (!chestTypes.length) {
    throw new Error(
      "No supported chest decks were found to publish."
    );
  }

  const records = [];

  for (const chestType of chestTypes) {
    records.push(
      await this.savePredictor({
        chestType,
        version,
        predictorData: {
          schema: "noir-live-event-v1",
          chestType,
          eventData: sanitisedEvent
        },
        uploadedBy: access.user.id
      })
    );
  }

  return {
    eventData: sanitisedEvent,
    records,
    version,
    publishedAt
  };
},

};


console.log(
  "Chest Companion: Database tools loaded."
);
