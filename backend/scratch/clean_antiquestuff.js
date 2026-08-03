const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Listing = require('./models/Listing');
    
    const userId = '6a11a9707d7dca41b6b205e9'; // theantiquestuff@gmail.com
    
    // Find all listings created today (after Aug 3, 2026 00:00:00 UTC)
    const docs = await Listing.find({ user: userId });
    let deletedCount = 0;
    
    for (const d of docs) {
      const timestamp = d._id.getTimestamp();
      if (timestamp >= new Date('2026-08-03T00:00:00.000Z')) {
        await Listing.findByIdAndDelete(d._id);
        deletedCount++;
        console.log(`Deleted new listing for theantiquestuff: "${d.title}"`);
      }
    }
    
    console.log(`Successfully deleted ${deletedCount} temporary listings for theantiquestuff@gmail.com.`);
    
    const finalCount = await Listing.countDocuments({ user: userId });
    console.log(`Final Listing count for theantiquestuff@gmail.com: ${finalCount}`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
