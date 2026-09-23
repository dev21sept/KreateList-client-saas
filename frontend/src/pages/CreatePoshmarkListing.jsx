import React from 'react';
import CreateMasterListing from './CreateMasterListing';

const CreatePoshmarkListing = (props) => {
  return (
    <CreateMasterListing 
      initialPlatform="poshmark" 
      isSinglePlatformOnly={true} 
      {...props} 
    />
  );
};

export default CreatePoshmarkListing;
