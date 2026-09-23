/**
 * Shiny's Merged Attack Cards
 *
 * dnd5e 6.x already renders saving throw and ability check results as compact "summaries" inside the activity
 * (usage) card and hides the separate chat messages. Attack, damage and healing messages don't opt in to this.
 * This module gives those message types a summary template, so the existing system logic merges them as well.
 */

const MODULE_ID = "shinys-merged-attack-cards";

/** Message type -> summary template. */
const SUMMARY_TEMPLATES = {
  attack: `modules/${MODULE_ID}/templates/attack-summary.hbs`,
  damage: `modules/${MODULE_ID}/templates/damage-summary.hbs`,
  healing: `modules/${MODULE_ID}/templates/damage-summary.hbs`
};

Hooks.once("init", () => {
  const models = CONFIG.ChatMessage.dataModels ?? {};

  for ( const [type, summaryTemplate] of Object.entries(SUMMARY_TEMPLATES) ) {
    const model = models[type];
    if ( !model ) {
      console.warn(`${MODULE_ID} | No chat message data model found for type "${type}", skipping.`);
      continue;
    }
    model.metadata = Object.freeze(foundry.utils.mergeObject(model.metadata, { summaryTemplate }, { inplace: false }));
  }
});

Hooks.once("ready", () => {
  if ( !game.settings.get("dnd5e", "chatCardSummary") ) {
    console.warn(`${MODULE_ID} | The dnd5e client setting "Summarize Chat Cards" is disabled, so messages will not be merged.`);
  }
});
