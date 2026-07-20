/* ============================================================
   CHEST COMPANION BETA
   LIVE PREDICTOR ENGINE

   Uses live about_v2 event data instead of spreadsheet files.

   ============================================================ */

(function initialiseLivePredictor(window) {
    "use strict";

    const SUPPORTED_CHESTS = [
        "gold",
        "platinum",
        "draconic",
        "freedom"
    ];

    let activeChest = "gold";
    let activeEvent = null;

    function getEventData() {
        return window.currentEventData || null;
    }

    function isReady() {
        const event = getEventData();

        return !!(
            event &&
            event.ready &&
            event.chests
        );
    }

    function getEventName() {
        const event = getEventData();

        return event?.event || "Unknown Event";
    }

    function setActiveChest(chest) {

        if (SUPPORTED_CHESTS.includes(chest)) {
            activeChest = chest;
        }

    }

    function getActiveChest() {
        return activeChest;
    }

    function getChest(chest = activeChest) {

        const event = getEventData();

        if (!event) {
            return null;
        }

        return event.chests[chest] || null;

    }

    function getDeck(chest = activeChest) {

        const chestData = getChest(chest);

        if (!chestData) {
            return [];
        }

        return chestData.deck || [];

    }

    function getCurrentIndex(chest = activeChest) {

        const chestData = getChest(chest);

        if (!chestData) {
            return null;
        }

        return chestData.index;

    }

    function getDeckLength(chest = activeChest) {

        return getDeck(chest).length;

    }

    function getStatus() {

        return {

            ready: isReady(),

            event: getEventName(),

            activeChest,

            chests: SUPPORTED_CHESTS.map(chest => {

                const deck = getDeck(chest);

                return {

                    chest,

                    length: deck.length,

                    index: getCurrentIndex(chest),

                    loaded: deck.length > 0

                };

            })

        };

    }

    window.LivePredictorEngine = Object.freeze({

        isReady,

        getStatus,

        getEventName,

        setActiveChest,

        getActiveChest,

        getDeck,

        getDeckLength,

        getCurrentIndex

    });

    console.info(
        "[Chest Companion] Live Predictor Engine ready."
    );

})(window);