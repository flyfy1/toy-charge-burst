// Charge Burst: this toy's own interface text in five languages (toy-specific, not a shared file).
// The text every toy shares (names for the More menu, Share, About) lives in i18n.ts.

const en = {
  desc_charge: "Hold to annoy a pufferfish. It gulps, swells and turns red. Let go early and it deflates with a raspberry; hold for two seconds and it blows its spines off. A tiny stress-relief toy, no sign-up.",
  hint_charge: "Hold to puff it up · let go",
  charge_pfft: ["pfft.", "That’s it?", "Weak."],
  charge_blew: "BLEW UP!",
  charge_bald: "It grows back. Probably.",
  share_charge: "🐡 Hold to make a pufferfish furious. Let go and see:",
  share_charge_stat: "🐡 I made a pufferfish blow its top {n} times. Your turn:",
}

const zhCN: typeof en = {
  desc_charge: "按住，把一只河豚气成球：它一口一口鼓起来，越来越红。松早了“噗”地泄气，憋满两秒直接气炸，刺都飞了。打开即玩的解压小玩具。",
  hint_charge: "按住憋气 · 松手放气",
  charge_pfft: ["噗——", "就这？", "泄气了。"],
  charge_blew: "气炸了！",
  charge_bald: "会长回来的。大概。",
  share_charge: "🐡 按住，把河豚气成球。松手试试：",
  share_charge_stat: "🐡 我把河豚气炸了 {n} 次，你也来：",
}

const es: typeof en = {
  desc_charge: "Mantén pulsado para enfadar a un pez globo: traga, se hincha y se pone rojo. Si sueltas pronto se desinfla con una pedorreta; si aguantas dos segundos revienta y pierde las púas. Un juguete antiestrés, sin registro.",
  hint_charge: "Mantén para inflarlo · suelta",
  charge_pfft: ["pfff.", "¿Ya está?", "Flojo."],
  charge_blew: "¡REVENTÓ!",
  charge_bald: "Vuelve a crecer. Seguramente.",
  share_charge: "🐡 Mantén pulsado y enfada a un pez globo. Suelta y verás:",
  share_charge_stat: "🐡 He hecho reventar de rabia a un pez globo {n} veces. Te toca:",
}

const fr: typeof en = {
  desc_charge: "Maintiens pour énerver un poisson-globe : il avale, gonfle et rougit. Lâche trop tôt et il se dégonfle en pétaradant ; tiens deux secondes et il explose en perdant ses piquants. Un petit jouet anti-stress, sans inscription.",
  hint_charge: "Maintiens pour le gonfler · lâche",
  charge_pfft: ["pfff.", "C’est tout ?", "Faiblard."],
  charge_blew: "IL EXPLOSE !",
  charge_bald: "Ça repousse. Normalement.",
  share_charge: "🐡 Maintiens pour énerver un poisson-globe. Lâche pour voir :",
  share_charge_stat: "🐡 J’ai fait exploser de rage un poisson-globe {n} fois. À toi :",
}

const ja: typeof en = {
  desc_charge: "長押しでフグを怒らせよう。ごくごく水を飲んでふくらみ、真っ赤に。早く離すと「ぷすー」としぼみ、2 秒ためるとブチギレてトゲが全部飛ぶ。登録不要のストレス解消トイ。",
  hint_charge: "長押しでふくらむ · 離すと…",
  charge_pfft: ["ぷすー。", "それだけ？", "しょぼい。"],
  charge_blew: "ブチギレ！",
  charge_bald: "また生える。たぶん。",
  share_charge: "🐡 長押しでフグを怒らせよう。離すとどうなる？",
  share_charge_stat: "🐡 フグを {n} 回ブチギレさせた。次はきみの番：",
}

export default { en, 'zh-CN': zhCN, es, fr, ja }
