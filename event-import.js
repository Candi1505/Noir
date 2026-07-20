"use strict";

/*
 * Noir Chest Companion
 * Live about_v2 importer
 */

const importButton = document.getElementById("importEventDataButton");
const fileInput = document.getElementById("eventDataFile");
const status = document.getElementById("eventImportStatus");
const badge = document.getElementById("eventImportBadge");
const results = document.getElementById("eventImportResults");

if (importButton) {

    importButton.addEventListener("click", async () => {

        if (!fileInput.files.length) {
            status.textContent = "Please choose an about_v2 file first.";
            return;
        }

        const file = fileInput.files[0];

        try {

            status.textContent = "Reading event...";

            const text = await file.text();

            const parsed = EventParser.parse(text);

            window.currentEventData = parsed;

            badge.textContent = "Ready";

            status.textContent =
                `${parsed.readyChestCount} chest deck(s) detected`;

            results.classList.remove("hidden");

            results.innerHTML = `
                <strong>${parsed.event}</strong><br><br>

                Gold:
                ${parsed.chests.gold.found ? "✅" : "❌"}<br>

                Platinum:
                ${parsed.chests.platinum.found ? "✅" : "❌"}<br>

                Draconic:
                ${parsed.chests.draconic.found ? "✅" : "❌"}<br>

                Freedom:
                ${parsed.chests.freedom.found ? "✅" : "❌"}
            `;

            console.log(parsed);

        }
        catch (error) {

            console.error(error);

            badge.textContent = "Failed";

            status.textContent = error.message;

        }

    });

}