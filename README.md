# Onyx Command

Onyx Command is a free, independent companion for the War Dragons community. It combines personal chest-sequence planning with capture-verified seasonal information and explainable planning tools.

The project was originally released as NOIR Chest Companion. The current foundation expands it into a broader command centre while preserving the existing predictor engines and player-isolation controls.

## Working features

- Secure email and password player accounts
- Independent player state and local progress isolation
- Gold, Platinum, Draconic, Freedom, Arcane and legacy Super Sigil predictor support
- Chest history, reward priorities and sequence tools
- Season Command with a Road to 20 Keys planner
- Capture-verified Misfitrise Wave 1 branch explorer
- Exact cheapest-route calculation from each player's claimed branch checkpoints
- Administrative event publication controls
- Existing base-planning foundations

## Data integrity

Onyx Command separates shared game-reference information from private player state.

- Raw HAR captures are never intended for source control or public distribution.
- Authentication credentials, device information and account identifiers are excluded from reference datasets.
- Seasonal information is labelled by capture date, wave and verification status.
- Estimates are presented separately from verified values.
- Regression tests protect player independence and cloud-data sanitisation.

The current Misfitrise capture verifies 25 keys across six Wave 1 sigil branches. It does not claim that 25 keys represent the entire season; later waves and mythic paths require additional verified data.

## Official API direction

Future Atlas and account-connected capabilities are intended to use authorised War Dragons API access. Onyx Command will request only the information required for an enabled feature and will not use one player's private state for another player.

## Development

The current application is a static browser app backed by Supabase for authenticated player and predictor services. The Onyx Command foundation is intentionally separated into:

- `onyx-command.css` — visual system and responsive shell
- `onyx-command.js` — dashboard and Season Command interaction
- `season-command-data.js` — versioned capture-verified season data and route engine
- existing predictor modules — proven chest and event logic

Automatic regression tests can be run directly with Node.js. Some event-import tests require a matching private HAR fixture and are intentionally not part of the no-input test set.

## Community project notice

Onyx Command is an independent fan-made companion and is not affiliated with or endorsed by Pocket Gems or War Dragons. Game names and trademarks remain the property of their respective owners.
