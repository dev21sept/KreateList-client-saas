import React from 'react';
import CreateMasterListing from './CreateMasterListing';

const CreateEtsyListing = (props) => {
  return (
    <CreateMasterListing 
      initialPlatform="etsy" 
      isSinglePlatformOnly={true} 
      {...props} 
    />
  );
};

export default CreateEtsyListing;
