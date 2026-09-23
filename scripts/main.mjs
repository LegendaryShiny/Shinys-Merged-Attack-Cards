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

/* -------------------------------------------- */
/*  Summary Contexts                            */
/* -------------------------------------------- */

/**
 * Add the data needed by the attack summary template.
 * @this {AttackMessageData}
 * @param {object} context  Render context to extend.
 */
async function extendAttackContext(context) {
  const isPrivate = !this.parent.isContentVisible;
  const { canCrit, displayResult, forceSuccess } = this;
  context.smacHeading = game.i18n.localize("DND5E.Attack");
  context.attacks = await Promise.all(this.parent.rolls.map(async roll => {
    const data = await roll._prepareChatRenderContext({
      canCrit, displayResult, forceSuccess, isPrivate, message: this.parent
    });
    return {
      classes: data.classes,
      formula: data.formula,
      icons: data.icons,
      isPrivate,
      tooltip: data.tooltip,
      total: data.total
    };
  }));
}

/* -------------------------------------------- */

/**
 * Add the data needed by the damage & healing summary template, with one entry per damage type.
 * @this {DamageMessageData}
 * @param {object} context  Render context to extend.
 */
async function extendDamageContext(context) {
  const isPrivate = !this.parent.isContentVisible;
  context.smacHeading = this.isHealing
    ? (CONFIG.DND5E.healingTypes.healing?.label ?? "Healing")
    : game.i18n.localize("DND5E.Damage");
  context.smacCritical = this.parent.rolls[0]?.isCritical === true;
  context.damages = dnd5e.dice.aggregateDamageRolls(this.parent.rolls).map(roll => {
    const type = roll.options.type;
    const config = CONFIG.DND5E.damageTypes[type] ?? CONFIG.DND5E.healingTypes[type] ?? null;
    const part = roll.aggregateTerms();
    part.config = config;
    part.label = config?.labelShort ?? config?.label ?? "";
    return {
      formula: roll.formula.replace(/^\s*\+\s*/, ""),
      isPrivate,
      parts: [part],
      total: Math.max(0, roll.total),
      typeIcon: config?.icon ?? "",
      typeLabel: config?.label ?? ""
    };
  });
}

/* -------------------------------------------- */

/**
 * Wrap a message data model's render context preparation so that it is extended when rendering a summary.
 * @param {string} type                  Chat message type.
 * @param {Function} extend              Function that adds to the render context.
 */
function wrapContext(type, extend) {
  const prototype = CONFIG.ChatMessage.dataModels?.[type]?.prototype;
  if ( !prototype ) return;
  const original = prototype._prepareContext;
  prototype._prepareContext = async function(options) {
    const context = await original.call(this, options);
    if ( options?.summary ) await extend.call(this, context);
    return context;
  };
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

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

  // Healing messages inherit from damage messages, so wrapping damage covers both.
  wrapContext("attack", extendAttackContext);
  wrapContext("damage", extendDamageContext);
});

Hooks.once("ready", () => {
  if ( !game.settings.get("dnd5e", "chatCardSummary") ) {
    console.warn(`${MODULE_ID} | The dnd5e client setting "Summarize Chat Cards" is disabled, so messages will not be merged.`);
  }
});
