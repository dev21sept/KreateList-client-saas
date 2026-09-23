import React from 'react';
import CreateMasterListing from './CreateMasterListing';

const CreateMercariListing = (props) => {
  return (
    <CreateMasterListing 
      initialPlatform="mercari" 
      isSinglePlatformOnly={true} 
      {...props} 
    />
  );
};

export default CreateMercariListing;
