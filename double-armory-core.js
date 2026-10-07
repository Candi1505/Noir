/* Shared-counter Double Armoury solver. No imported player cursor is trusted
 * for another player. Each pool retains every position consistent with history. */
(function (root) {
  'use strict';
  const LIMIT = 12000;
  const copy = x => JSON.parse(JSON.stringify(x));
  const signature = r => `${r.code}|${Number(r.amount)}`;
  const unknown = { code: '', name: 'Position unresolved', amount: null, rarity: 'Unknown', exact: false };
  function terminal(def, pool) {
    if (!def || !def.id || !Number.isFinite(Number(def.mu)) || Number(def.sdev || 0) !== 0) return null;
    return { code: def.id, amount: Number(def.mu), rarity: def.drop_type || (/mythic/i.test(pool) ? 'Mythic' : /legendary/i.test(pool) ? 'Legendary' : 'Epic'), exact: true };
  }
  function sharedSide(data, armory) {
    const side = data.sides[armory], periods = {};
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    for (const [key, deck] of Object.entries(side.decks)) {
      const other = data.sides[armory === 'assault' ? 'breeding' : 'assault'].decks[key];
      periods[key] = other?.length ? deck.length * other.length / gcd(deck.length, other.length) : deck.length;
      if (periods[key] > LIMIT) throw Error('Shared pool period exceeds solver limit');
    }
    return { ...side, periods };
  }
  function draw(side, key, state, depth = 0) {
    if (depth > 8) throw Error('Unsupported cyclic reward pool');
    const deck = side.decks?.[key], defs = side.drops?.[key];
    if (!Array.isArray(deck) || !deck.length || !Array.isArray(defs)) throw Error('Missing ordered reward pool');
    const period = side.periods?.[key] || deck.length;
    const positions = state[key] || Array.from({length: period}, (_, i) => i);
    const groups = new Map();
    for (const pos of positions) {
      const def = defs[deck[pos % deck.length]];
      if (!def) throw Error('Missing reward definition');
      const nested = Array.isArray(side.decks?.[def.id]);
      if (def.kind === 'drop' && !nested) throw Error('Nested reward pool unavailable');
      if (nested && (Number(def.mu ?? 1) !== 1 || Number(def.sdev || 0) !== 0))
        throw Error('Nested reward count is not a verified single draw');
      const reward = nested ? null : terminal(def, key);
      if (!nested && !reward) throw Error('Variable or unresolved reward amount');
      const id = nested ? `pool:${def.id}` : signature(reward);
      if (!groups.has(id)) groups.set(id, { def, nested, reward, positions: [] });
      groups.get(id).positions.push((pos + 1) % period);
    }
    const out = [];
    for (const group of groups.values()) {
      const next = { ...state, [key]: group.positions };
      if (group.nested) out.push(...draw(side, group.def.id, next, depth + 1));
      else out.push({ state: next, reward: group.reward });
      if (out.length > LIMIT) throw Error('Too many possible positions');
    }
    return out;
  }
  function compact(states) {
    const unique = new Map();
    for (const state of states) {
      const key = JSON.stringify(Object.keys(state).sort().map(k => [k, state[k]]));
      unique.set(key, state);
      if (unique.size > LIMIT) throw Error('Too many possible positions');
    }
    return [...unique.values()];
  }
  function rootKey(side, type, bonus) {
    const chest = side.chests?.[type];
    const key = bonus ? chest?.bonusKey : chest?.mainKey;
    if (!key) throw Error(bonus ? 'Bonus pool is not verified for this chest' : 'Chest deck unavailable');
    return key;
  }
  function solve(data, type, observations = [], initialState = {}) {
    try {
      let states = [copy(initialState)];
      for (const observation of observations) {
        const side = data.sides[observation.armory] && sharedSide(data, observation.armory);
        if (!side) throw Error('Unknown armoury');
        const key = rootKey(side, type, observation.isBonus);
        const wanted = signature(observation.reward);
        states = compact(states.flatMap(state => draw(side, key, state).filter(r => signature(r.reward) === wanted).map(r => r.state)));
        if (!states.length) return { matched: false, states: [], reason: 'The recorded rewards do not match these decks.' };
      }
      return { matched: true, states, observed: observations.length };
    } catch (error) {
      return { matched: false, states: [], reason: error.message };
    }
  }
  function forecast(data, type, solution, armory, count = 20, bonus = false) {
    if (!solution.matched || !solution.observed) return [];
    let states = copy(solution.states);
    const rows = [];
    try {
      const side = sharedSide(data, armory);
      const key = rootKey(side, type, bonus);
      for (let n = 0; n < count; n++) {
        const draws = states.flatMap(state => draw(side, key, state));
        const rewards = new Map(draws.map(r => [signature(r.reward), r.reward]));
        if (rewards.size !== 1) { rows.push({ ...unknown, possibilities: rewards.size }); break; }
        rows.push({ ...rewards.values().next().value, number: n + 1 });
        states = compact(draws.map(r => r.state));
      }
    } catch (error) { rows.push({ ...unknown, reason: error.message }); }
    return rows;
  }
  function catalogue(side, type, bonus = false) {
    try { return [...new Map(draw(side, rootKey(side, type, bonus), {}).map(r => [signature(r.reward), r.reward])).values()]; }
    catch (_) { return []; }
  }
  function prepareCapture(data, result) {
    if (!result.gachaData || result.gachaData.scanTruncated || result.gachaData.errors?.length || result.gachaData.unknownSpinTypes?.length)
      throw Error('Capture history is incomplete or contains unreadable openings; positions cannot be restored safely.');
    const captured = result.eventData?.doubleArmory;
    const timestamp = Date.parse(result.importDiagnostics?.diagnostics?.sourceTimestamp);
    if (!captured || !Number.isFinite(timestamp)) throw Error('Capture needs a dated event setup response.');
    for (const side of ['assault', 'breeding']) {
      if (data.sides[side].eventKey !== captured.sides?.[side]?.eventKey ||
          JSON.stringify(data.sides[side].decks) !== JSON.stringify(captured.sides[side].decks))
        throw Error('This capture uses different event decks. Import the matching current event first.');
    }
    const nextPositions = {};
    for (const [key, deck] of Object.entries(captured.sides.assault.decks)) {
      const value = captured.sides.assault.deckIndices?.[key];
      const other = captured.sides.breeding.deckIndices?.[key];
      if (Number.isInteger(value) && value >= 0 && value === other && deck.length)
        nextPositions[key] = [value + 1];
    }
    const openings = (result.gachaData?.openings || []).slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const chests = {};
    let verifiedDrops = 0;
    for (const type of data.availableChestTypes) {
      const observations = [];
      for (const opening of openings) {
        if (!Number.isFinite(Date.parse(opening.timestamp))) throw Error('An opening has no reliable timestamp.');
        if (Date.parse(opening.timestamp) <= timestamp || opening.parentChestKey !== type) continue;
        const armory = ['assault', 'breeding'].find(side => data.sides[side].eventKey === opening.eventId);
        if (!armory || opening.responseSuccess === false) continue;
        if (opening.orderedDrops?.length !== opening.count) throw Error('A batch has incomplete draw order; it cannot anchor the sequence.');
        for (const reward of opening.orderedDrops) observations.push({ armory, isBonus: opening.isBonus, reward, recordedAt: opening.timestamp });
      }
      if (!observations.length) continue;
      const solution = solve(data, type, observations, nextPositions);
      if (!solution.matched) throw Error(`The ${type} capture does not replay correctly: ${solution.reason}`);
      chests[type] = { observations, initialState: copy(nextPositions), preferences: {}, captureVerified: true };
      verifiedDrops += observations.length;
    }
    if (!verifiedDrops) throw Error('No complete openings after the event snapshot were available to verify.');
    return { chests, verifiedDrops };
  }
  const api = Object.freeze({ solve, forecast, catalogue, signature, prepareCapture });
  root.DoubleArmoryCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
