
'use strict';

angular.module('copayApp.controllers')
  .controller('recoveryFileChooserCtrl', RecoveryFileChooserCtrl);

function RecoveryFileChooserCtrl(
  $rootScope, $scope, $modalInstance, $timeout,
  isCordova, cloudsStoragesService
) {
  $scope.screenType = 'storages';
  $scope.cloudStorages = cloudsStoragesService.getSet();
  $scope.currCloudStorage;
  $scope.chooseList = [];
  $scope.bLoading = false;
  var elFileSelector;

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
    console.log('RecoveryFileChooserCtrl $destroy');
  });

  $scope.$watch('$viewContentLoaded', function () {
		$timeout(function () {
			elFileSelector = document.querySelector('#fileSelector');
			console.log('ContinuousBackupCtrl viewContentLoaded elFileSelector', elFileSelector);
			if (!elFileSelector) {
				return;
			}

			elFileSelector.addEventListener('change', function (event) {
				var file = (event.srcElement || event.target).files[0];
				console.log('ContinuousBackupCtrl getFile', file, event);
				if (!file) {
					return;
        }
        
        $modalInstance.close({
          type: 'local',
          file: file,
        });
			});
		});
	});

  $scope.isLocalStorageAvailable = function () {
		return !isCordova && elFileSelector;
  };
  
  $scope.selectLocalFile = function () {
    elFileSelector.click();
  };
  
  $scope.checkCloudStorageLogedIn = function (key) {
		const cloudStorage = $scope.cloudStorages[key];
		return cloudStorage.isAuthenticated() && cloudStorage.isInited;
  };

  $scope.openCloudStorageFilesList = function (key) {
    console.log('RecoveryFileChooserCtrl openCloudStorageFilesList', key);
    const cloudStorage = $scope.cloudStorages[key];

    $scope.bLoading = true;

    return cloudStorage.loadFilesListAuth()
      .then(function (list) {
        console.log('RecoveryFileChooserCtrl openCloudStorageFilesList loadFilesListAuth', key, list);
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
    console.log('RecoveryFileChooserCtrl chooseFile', $scope.currCloudStorageKey);
    const cloudStorage = $scope.cloudStorages[$scope.currCloudStorageKey];

    $scope.bLoading = true;

    return cloudStorage.downloadFileAuth(sFilePath)
      .then(function (file) {
        console.log('RecoveryFileChooserCtrl chooseFile downloadFileAuth', $scope.currCloudStorageKey, file);
        $modalInstance.close({
          type: 'cloud',
          file: file
        });
      })
      .catch(function (err) {
        $scope.bLoading = false;
        console.error(err);
      })
      .then(function () {
        handleUpdateScope();
      });
  }

  $scope.getCurrentCloudTitle = function () {
    if (!$scope.currCloudStorageKey) {
      return;
    }
    return $scope.cloudStorages[$scope.currCloudStorageKey].getTitle();
  };

  $scope.backToStorageSelect = function () {
    $scope.screenType = 'storages';
    $scope.currCloudStorageKey = null;
  };

  $scope.getFile = function() {
    $timeout(function() {
      $rootScope.$apply();
    });
  };

	function handleUpdateScope() {
    console.log('RecoveryFileChooserCtrl handleUpdateScope');
		$scope.$apply();
	}

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}
