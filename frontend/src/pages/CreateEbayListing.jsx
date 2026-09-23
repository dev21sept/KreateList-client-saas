import React from 'react';
import CreateMasterListing from './CreateMasterListing';

const CreateEbayListing = (props) => {
  return (
    <CreateMasterListing 
      initialPlatform="ebay" 
      isSinglePlatformOnly={true} 
      {...props} 
    />
  );
};

export default CreateEbayListing;
