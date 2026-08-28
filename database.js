/* =========================================================
   ONYX COMMAND
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
        isAdmin: false,
        isApproved: false
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
        this.isAdminProfile(profile),
      isApproved:
        this.isAdminProfile(profile) ||
        profile?.access_approved === true
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
        "This account does not have Onyx administrator access."
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

  async signUpMember(
    email,
    password,
    nickname = ""
  ) {
    const cleanEmail =
      String(email || "").trim();
    const cleanPassword =
      String(password || "");
    const cleanNickname =
      String(nickname || "")
        .trim()
        .slice(0, 30);

    if (!cleanEmail) {
      throw new Error(
        "Enter your email address."
      );
    }

    if (cleanPassword.length < 8) {
      throw new Error(
        "Use a password with at least 8 characters."
      );
    }

    const { data, error } =
      await window.chestSupabase.functions
        .invoke(
          "noir-register",
          {
            body: {
              email: cleanEmail,
              password: cleanPassword,
              nickname:
                cleanNickname || "Player"
            }
          }
        );

    if (error) {
      let responseMessage = "";

      try {
        const responseBody =
          await error.context?.json?.();
        responseMessage =
          String(responseBody?.message || "");
      } catch (readError) {
        /* Use the safe fallback below. */
      }

      throw new Error(
        responseMessage ||
        error.message ||
        "Your account could not be created."
      );
    }

    if (!data?.ok) {
      throw new Error(
        data?.message ||
        "Your account could not be created."
      );
    }

    const access =
      await this.signInMember(
        cleanEmail,
        cleanPassword
      );

    return {
      ...access,
      confirmationRequired: false
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

    Onyx Command never creates anonymous accounts. A player
    must explicitly sign in with an email and password.
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
    Onyx Command creates one automatically.
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
    Starts Onyx Command's cloud connection.

    This returns:

    - the authenticated Supabase user
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
        profile: null,
        isAdmin: false,
        isApproved: false
      };

    }


    const profile =
      await this.getOrCreateProfile(user);

    const isAdmin =
      this.isAdminProfile(profile);

    const isApproved =
      isAdmin ||
      profile?.access_approved === true;


    return {

      session,

      user,

      profile,

      isAdmin,

      isApproved

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

  async getAuthenticatedProfileUser() {
    const supabaseClient = window.chestSupabase;

    if (!supabaseClient) {
      throw new Error("Supabase is not connected.");
    }

    const { data, error } = await supabaseClient.auth.getUser();

    if (error) throw error;
    if (!data.user) {
      throw new Error("Sign in to sync your Onyx profile.");
    }

    return data.user;
  },

  async loadOnyxCommandState() {
    const user = await this.getAuthenticatedProfileUser();
    const { data, error } = await window.chestSupabase
      .from("profiles")
      .select("onyx_command_preferences")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.onyx_command_preferences || null;
  },

  async saveOnyxCommandState(state) {
    const rawKeys = state?.currentKeys;
    const currentKeys = rawKeys === null || rawKeys === undefined
      ? null
      : Number(rawKeys);
    const rawSigils = state?.currentSigils;
    const currentSigils = rawSigils === null || rawSigils === undefined
      ? null
      : Number(rawSigils);

    if (
      currentKeys !== null &&
      (!Number.isInteger(currentKeys) || currentKeys < 0 || currentKeys > 40)
    ) {
      throw new Error("Current keys must be a whole number from 0 to 40.");
    }
    if (
      currentSigils !== null &&
      (!Number.isInteger(currentSigils) || currentSigils < 0 || currentSigils > 100000000)
    ) {
      throw new Error("Current sigils must be a whole number from 0 to 100,000,000.");
    }

    const branchLimits = {
      "brickscale": 6,
      "mission-bonus": 2,
      "base-boost": 6,
      "charged-volt-tower": 6,
      "cosmic-orrery": 2,
      "bloodstone": 3
    };
    const branchKeys = {};
    for (const [slug, maximum] of Object.entries(branchLimits)) {
      const value = Number(state?.branchKeys?.[slug] ?? 0);
      if (!Number.isInteger(value) || value < 0 || value > maximum) {
        throw new Error(`Invalid claimed-key checkpoint for ${slug}.`);
      }
      branchKeys[slug] = value;
    }

    const mythicChoice = ["", "Patchmaw", "Smirkle"].includes(state?.mythicChoice)
      ? state.mythicChoice
      : "";

    const user = await this.getAuthenticatedProfileUser();
    const preferences = {
      version: 2,
      currentKeys,
      currentSigils,
      seasonRelease: "misfitrise-wave-1",
      seasonTarget: 20,
      mythicChoice,
      branchKeys,
      updatedAt: new Date().toISOString()
    };
    const { data, error } = await window.chestSupabase
      .from("profiles")
      .update({ onyx_command_preferences: preferences })
      .eq("user_id", user.id)
      .select("onyx_command_preferences")
      .single();

    if (error) throw error;
    return data.onyx_command_preferences;
  },

  async loadOnyxBaseLayout() {
    const user = await this.getAuthenticatedProfileUser();
    const { data, error } = await window.chestSupabase
      .from("player_base_layouts")
      .select("layout")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.layout || null;
  },

  async saveOnyxBaseLayout(layout) {
    let cleanLayout = null;

    if (layout !== null) {
      if (!layout || !Array.isArray(layout.slots) || layout.slots.length !== 40) {
        throw new Error("An Onyx base layout must contain exactly 40 slots.");
      }

      const cleanText = (value, maximum) =>
        String(value || "").trim().replace(/\s+/g, " ").slice(0, maximum);
      const cleanWholeNumber = (value, minimum, maximum, fallback = minimum) => {
        const number = Number(value);
        return Number.isInteger(number) && number >= minimum && number <= maximum
          ? number
          : fallback;
      };
      const cleanMonument = selection => {
        const name = cleanText(selection?.name, 120);
        if (!name) return null;
        return {
          name,
          level: cleanWholeNumber(selection?.level, 1, 99, 1)
        };
      };

      const cleanSlots = layout.slots.map(slot => {
        if (slot === null) return null;
        const type = cleanText(slot?.type, 80);
        const level = Number(slot?.level);
        const notes = String(slot?.notes || "").trim().slice(0, 250);

        if (!type || !Number.isInteger(level) || level < 1 || level > 999) {
          throw new Error("Each recorded tower needs a tower type and valid level.");
        }

        return {
          type,
          level,
          notes,
          rune: cleanMonument(slot?.rune),
          glyph: cleanMonument(slot?.glyph),
          relic: cleanMonument(slot?.relic)
        };
      });

      const perchNames = ["Riverwatch Perch", "Seagazer Perch", "Stonespear Perch"];
      const gearSlots = ["head", "chest", "gloves", "pants", "boots", "weapons", "shield", "rings"];
      const sourcePerches = Array.isArray(layout.perches) ? layout.perches : [];
      const cleanPerches = perchNames.map((name, index) => {
        const perch = sourcePerches[index] && typeof sourcePerches[index] === "object"
          ? sourcePerches[index]
          : {};
        const skills = (Array.isArray(perch.skills) ? perch.skills : []).slice(0, 32).map(skill => {
          const skillName = cleanText(skill?.name, 120);
          return skillName
            ? { name: skillName, level: cleanWholeNumber(skill?.level, 1, 99, 1) }
            : null;
        }).filter(Boolean);
        const gear = Object.fromEntries(gearSlots.map(slot => {
          const item = perch.gear?.[slot];
          const itemName = cleanText(item?.name, 120);
          return [slot, itemName ? {
            name: itemName,
            rarity: cleanText(item?.rarity, 32),
            level: cleanWholeNumber(item?.level, 0, 99, 0)
          } : null];
        }));
        return {
          name,
          level: cleanWholeNumber(perch.level, 0, 999, 0),
          dragonName: cleanText(perch.dragonName, 120),
          dragonClass: cleanText(perch.dragonClass, 40),
          dragonTier: cleanText(perch.dragonTier, 80),
          dragonLevel: cleanWholeNumber(perch.dragonLevel, 0, 999, 0),
          riderName: cleanText(perch.riderName, 120),
          riderLevel: cleanWholeNumber(perch.riderLevel, 0, 999, 0),
          elementalResistance: cleanText(perch.elementalResistance, 40),
          towerBonus: cleanText(perch.towerBonus, 40),
          specialBonus: cleanText(perch.specialBonus, 40),
          skills,
          gear
        };
      });

      cleanLayout = {
        version: 2,
        name: String(layout.name || "My Base").trim().slice(0, 60) || "My Base",
        slots: cleanSlots,
        perches: cleanPerches,
        updatedAt: new Date().toISOString()
      };
    }

    const user = await this.getAuthenticatedProfileUser();

    if (cleanLayout === null) {
      const { error } = await window.chestSupabase
        .from("player_base_layouts")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      return null;
    }

    const { data, error } = await window.chestSupabase
      .from("player_base_layouts")
      .upsert(
        {
          user_id: user.id,
          layout: cleanLayout,
          updated_at: cleanLayout.updatedAt
        },
        { onConflict: "user_id" }
      )
      .select("layout")
      .single();

    if (error) throw error;
    return data.layout;
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
    "freedom",
    "arcane",
    "super_sigil"
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
  const supabaseClient =
    window.chestSupabase;

  if (!supabaseClient) {
    throw new Error(
      "Supabase is not connected."
    );
  }

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

  const requiredChestTypes = [
    "gold",
    "platinum",
    "draconic",
    "freedom",
    "arcane",
    "super_sigil"
  ];

  const incompleteChestTypes =
    requiredChestTypes.filter(
      chestType => {
        const chest =
          eventData.chests[
            chestType
          ];

        return !(
          chest?.found === true &&
          Array.isArray(chest.deck) &&
          chest.deck.length > 0 &&
          !(
            Array.isArray(chest.warnings) &&
            chest.warnings.length > 0
          )
        );
      }
    );

  if (
    eventData.ready !== true ||
    Number(eventData.readyChestCount) !==
      requiredChestTypes.length ||
    incompleteChestTypes.length
  ) {
    throw new Error(
      `The live event is incomplete (${incompleteChestTypes.join(", ") || "readiness check"}). No cloud predictor records were changed.`
    );
  }

  const publishedAt =
    new Date().toISOString();

  const version =
    Math.floor(Date.now() / 1000);

  const privateChestFields = [
    "index",
    "foundIndex",
    "sourceIndex",
    "currentValue",
    "openedSinceBonus",
    "chestsUntilBonus",
    "nextChestIsBonus",
    "warnings"
  ];

  const sharedChests =
    Object.fromEntries(
      Object.entries(eventData.chests)
        .map(([chestType, chestData]) => {
          const sharedChest = {
            ...(chestData || {})
          };

          privateChestFields.forEach(
            field => {
              delete sharedChest[field];
            }
          );

          return [
            chestType,
            sharedChest
          ];
        })
    );

  const sharedDoubleArmory =
    eventData.doubleArmory &&
    typeof eventData.doubleArmory ===
      "object"
      ? {
          ...eventData.doubleArmory,
          sides: Object.fromEntries(
            Object.entries(
              eventData.doubleArmory.sides ||
              {}
            ).map(([sideType, sideData]) => {
              const sharedSide = {
                ...(sideData || {})
              };

              /*
               * Each armory side carries the importing administrator's
               * personal deck cursors. Decks and drops may be shared, but
               * those cursor positions must remain on their device.
               */
              delete sharedSide.deckIndices;

              return [
                sideType,
                sharedSide
              ];
            })
          )
        }
      : {
          detected: false,
          ready: false,
          sides: {}
        };

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
    chests: sharedChests,
    decks: eventData.decks || {},
    drops: eventData.drops || {},
    /*
     * Deck cursor positions identify the administrator's account and must
     * never be published as shared player state.
     */
    deckIndices: {},
    spinTypes:
      eventData.spinTypes || [],
    doubleArmory:
      sharedDoubleArmory
  };

  const chestTypes = [
    "gold",
    "platinum",
    "draconic",
    "freedom",
    "arcane",
    "super_sigil"
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

  /*
   * Publish the complete event in one database transaction. A failed fifth
   * chest must never leave the first four pointing at a different event.
   */
  const predictors = chestTypes.map(
    chestType => ({
      chest_type: chestType,
      predictor_data: {
        schema: "noir-live-event-v1",
        chestType,
        eventData: sanitisedEvent
      }
    })
  );

  const {
    data: publishedRows,
    error: publishError
  } = await supabaseClient.rpc(
    "publish_noir_event",
    {
      p_version: version,
      p_predictors: predictors
    }
  );

  if (publishError) {
    const atomicPublisherMissing =
      publishError.code === "PGRST202" ||
      /publish_noir_event|schema cache|function/i
        .test(String(publishError.message || ""));

    if (atomicPublisherMissing) {
      throw new Error(
        "The Supabase Arcane publishing update is required before this event can be published. No cloud predictor records were changed."
      );
    }

    throw publishError;
  }

  const records = Array.isArray(publishedRows)
    ? publishedRows
    : publishedRows
      ? [publishedRows]
      : [];

  if (records.length !== chestTypes.length) {
    throw new Error(
      "Supabase did not confirm every chest predictor. The event was not accepted as published."
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
  "Onyx Command: Database tools loaded."
);
