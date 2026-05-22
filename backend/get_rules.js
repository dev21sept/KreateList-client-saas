const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Rule = require('./models/Rule');
const Listing = require('./models/Listing');

dotenv.config();

const showData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected.');

    const rules = await Rule.find({});
    console.log('--- RULES IN DATABASE ---');
    rules.forEach((r, idx) => {
      console.log(`\nRule #${idx + 1}`);
      console.log(`ID: ${r._id}`);
      console.log(`Name: ${r.name}`);
      console.log(`Title Sequence: ${JSON.stringify(r.title_sequence)}`);
      console.log(`Description Prompt:`);
      console.log(r.description_prompt);
      console.log(`Condition Note: ${r.condition_note}`);
      console.log('------------------------');
    });

    const listings = await Listing.find({});
    console.log('\n--- LISTINGS IN DATABASE ---');
    listings.forEach((l, idx) => {
      console.log(`\nListing #${idx + 1}`);
      console.log(`ID: ${l._id}`);
      console.log(`Title: ${l.title}`);
      console.log(`SKU: ${l.sku}`);
      console.log(`Description:`);
      console.log(l.description);
      console.log('------------------------');
    });

    process.exit();
  } catch (err) {
    console.error('Error fetching data:', err.message);
    process.exit(1);
  }
};

showData();
