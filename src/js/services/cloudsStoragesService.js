'use strict';
angular.module('copayApp.services')
	.factory('cloudsStoragesService', CloudsStoragesServiceFactory);
	
function CloudsStoragesServiceFactory($log, configService, isCordova) {
  const config = configService.getSync();
  const fetch = require('isomorphic-fetch');
  const cloudStorages = new CloudStorages({
    log: $log,
    fetchModule: fetch,
    isCordova: isCordova,
    handleSaveData: handleSaveData,
  });

  function handleSaveData(data) {
    const cloudStoragesConfig = config.cloudStorages;
    for (let key in data) {
      cloudStoragesConfig[key] = data[key];
    }

    console.log('CloudsStoragesServiceFactory handleSaveData', cloudStoragesConfig);
		configService.set(
      { cloudStorages: cloudStoragesConfig },
      (err) => {
        if (err) {
          console.error(err);
          $scope.$emit('Local/DeviceError', err);
        }
      }
    );
  }

  console.log('CloudsStoragesServiceFactory config cloudStorages', config.cloudStorages);
  const options = {
    "clientId": "w3dc28uvqy5352v",
    "clientSecret": "rla27s8ntyvia4m"
  };
  options.data = config.cloudStorages.dropbox || {};
  const storage = new DropboxCloudStorage(options);
  cloudStorages.add(storage);

  cloudStorages.init()
    .then(() => {
      console.log('CloudsStoragesServiceFactory cloudStorages inited');
    })
    .catch((err) => {
      console.log('CloudsStoragesServiceFactory cloudStorages init ERROR', err);
    });
  
  if (!isCordova) {
    const win = require('nw.gui').Window.get();
    win.on('close', () => {
      cloudStorages.closeWindows();
      win.close(true);
    });
  }

  return {
    getSet() {
      return cloudStorages.getSet();
    },
    get(key) {
      return cloudStorages.get(key);
    },
    getKeys() {
      return cloudStorages.getKeys();
    }
  };
}
