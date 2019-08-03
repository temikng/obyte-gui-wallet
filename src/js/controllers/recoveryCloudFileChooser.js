
'use strict';

angular.module('copayApp.controllers')
  .controller('recoveryCloudFileChooserCtrl', RecoveryCloudFileChooserCtrl);

function RecoveryCloudFileChooserCtrl($scope, $modalInstance, cloudsStoragesService) {
  $scope.screenType = 'cloud';
  $scope.cloudStorages = cloudsStoragesService.getSet();
  $scope.currCloudStorage;
  $scope.chooseList = [];
  $scope.bLoading = false;

  for (const key in $scope.cloudStorages) {
		const cloudStorage = $scope.cloudStorages[key];
		cloudStorage.on(CloudStorageEvents.ChangedAuthStatus, handleUpdateScope);
		cloudStorage.once(CloudStorageEvents.Inited, handleUpdateScope);
	}

	$scope.$on('$destroy', function () {
		for (const key in $scope.cloudStorages) {
			const cloudStorage = $scope.cloudStorages[key];
      cloudStorage.removeListener(CloudStorageEvents.ChangedAuthStatus, handleUpdateScope);
      cloudStorage.removeListener(CloudStorageEvents.Inited, handleUpdateScope);
    }
    console.log('RecoveryCloudFileChooserCtrl $destroy');
  });
  
  $scope.checkCloudStorageLogedIn = function (key) {
		const cloudStorage = $scope.cloudStorages[key];
		return cloudStorage.isAuthenticated() && cloudStorage.isInited;
  };

  $scope.openCloudStorageFilesList = function (key) {
    console.log('RecoveryCloudFileChooserCtrl openCloudStorageFilesList', key);
    const cloudStorage = $scope.cloudStorages[key];

    $scope.bLoading = true;

    return cloudStorage.loadFilesListAuth()
      .then(function (list) {
        console.log('RecoveryCloudFileChooserCtrl openCloudStorageFilesList loadFilesListAuth', key, list);
        $scope.screenType = 'files';
        $scope.currCloudStorageKey = key;
        $scope.chooseList = list;
      })
      .catch(function (err) {
        console.error(err);
      })
      .then(function () {
        $scope.bLoading = false;
        handleUpdateScope();
      });
  };

  $scope.chooseFile = function (sFilePath) {
    console.log('RecoveryCloudFileChooserCtrl chooseFile', $scope.currCloudStorageKey);
    const cloudStorage = $scope.cloudStorages[$scope.currCloudStorageKey];

    $scope.bLoading = true;

    return cloudStorage.downloadFileAuth(sFilePath)
      .then(function (data) {
        console.log('RecoveryCloudFileChooserCtrl chooseFile downloadFileAuth', $scope.currCloudStorageKey, data);
        $modalInstance.close(data);
      })
      .catch(function (err) {
        $scope.bLoading = false;
        console.error(err);
      })
      .then(function () {
        handleUpdateScope();
      });
  }

	function handleUpdateScope() {
    console.log('RecoveryCloudFileChooserCtrl handleUpdateScope');
		$scope.$apply();
	}

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}
