/**
 * Script one-shot : supprime les conversations dupliquées (mêmes participants, _id différents).
 * Garde la plus ancienne (celle qui a les messages), supprime les autres.
 * Usage : node backend/cleanup-conv-duplicates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const ConversationPro = require('./Model/ConversationPro');
const MessagePro      = require('./Model/MessagePro');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connecté à MongoDB');

  const all = await ConversationPro.find().lean();

  // Grouper par paire de participants triée
  const groups = {};
  for (const c of all) {
    const key = c.participants.map(String).sort().join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  let deleted = 0;
  for (const [key, convs] of Object.entries(groups)) {
    if (convs.length <= 1) continue;

    // Trier : garder la plus ancienne (createdAt le plus petit)
    convs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const keep    = convs[0];
    const toDelete = convs.slice(1);

    console.log(`\nDuplicate pour [${key}]`);
    console.log(`  ✓ Garder  : ${keep._id} (créé ${keep.createdAt})`);

    for (const dup of toDelete) {
      console.log(`  ✗ Supprimer: ${dup._id} (créé ${dup.createdAt})`);

      // Reparenter les messages vers la conv gardée
      const moved = await MessagePro.updateMany(
        { conversationId: dup._id },
        { $set: { conversationId: keep._id } }
      );
      if (moved.modifiedCount > 0)
        console.log(`    → ${moved.modifiedCount} message(s) déplacé(s) vers ${keep._id}`);

      await ConversationPro.deleteOne({ _id: dup._id });
      deleted++;
    }
  }

  console.log(`\nTerminé : ${deleted} conversation(s) supprimée(s).`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
