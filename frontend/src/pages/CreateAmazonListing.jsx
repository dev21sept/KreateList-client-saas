import React from 'react';
import CreateMasterListing from './CreateMasterListing';

const CreateAmazonListing = (props) => {
  return (
    <CreateMasterListing 
      initialPlatform="amazon" 
      isSinglePlatformOnly={true} 
      {...props} 
    />
  );
};

export default CreateAmazonListing;
