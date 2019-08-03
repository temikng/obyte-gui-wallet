'use strict';

angular.module('copayApp.controllers')
	.controller('recoveryCtrl', RecoveryCtrl);

function RecoveryCtrl($rootScope, $scope, $timeout, $modal, configService, continuousBackupService, profileService) {
	var Mnemonic = require('bitcore-mnemonic');
	var config = configService.getSync();

	$scope.importing = false;
	$scope.inputMnemonic =  profileService.focusedClient.getMnemonic();
	$scope.turnOnBackup = false;
	$scope.error = '';

	$scope.$on('$destroy', function () {
		console.log('RecoveryCtrl $destroy');
	});

	$scope.getFile = function () {
		$timeout(function () {
			$rootScope.$apply();
		});
	};

	$scope.clearFile = function () {
		$scope.file = null;
	};

	$scope.isSubmitDisabled = function () {
		return $scope.importing || !$scope.inputMnemonic || (!$scope.file && !$scope.oldAndroidFilePath);
	}

	$scope.isTurnOnBackupBtnDisabled = function () {
		return !$scope.file || $scope.importing;
	}

	$scope.openChooserCloudFileModal = function () {
		var modalInstance = $modal.open({
			templateUrl: 'views/modals/recovery-cloud-file-chooser.html',
			controller: 'recoveryCloudFileChooserCtrl'
		});
		$rootScope.$on('closeModal', function () {
			modalInstance.dismiss('cancel');
		});
		modalInstance.result.finally(function () {
			var m = angular.element(document.getElementsByClassName('reveal-modal'));
			m.addClass(animationService.modalAnimated.slideOutDown);
		});
		modalInstance.result
			.then(function (file) {
				console.log('RecoveryCtrl modal then', file);
				$scope.file = file;
			});
	}

	$scope.recoveryForm = function () {
		console.log('RecoveryCtrl recoveryForm', $scope.inputMnemonic, $scope.file, $scope.turnOnBackup);
		if ($scope.isSubmitDisabled()) {
			return;
		}

		var sMnemonic = $scope.inputMnemonic.toLowerCase();
		if (!checkMnemonicValid(sMnemonic)) {
			$scope.error = 'Seed is not valid';
			return;
		}

		$scope.error = '';
		$scope.importing = true;
		// var filePath = $scope.file.path;

		continuousBackupService.doFileRestore(getMnemonicKey(sMnemonic), $scope.file, function (err) {
			if (err) {
				showError(err);
				return;
			}

			// if ($scope.turnOnBackup) {
			// 	var dirPath = path.dirname(filePath);
			// 	console.log('RecoveryCtrl recoveryForm dirPath', dirPath);

			// 	var opts = {
			// 		continuousBackup: {
			// 			backgroundTurnOn: true,
			// 			dirPath: dirPath,
			// 		},
			// 	};
	
			// 	$timeout(function () {
			// 		console.log('RecoveryCtrl recoveryForm get config', config);
			// 		configService.set(opts, function (err) {
			// 			if (err) {
			// 				console.error(err);
			// 				$scope.$emit('Local/DeviceError', err);
			// 				return;
			// 			}
						
			// 			console.log('RecoveryCtrl recoveryForm set config', opts);
			// 			$scope.importing = false;
			// 			showSuccessfullyCompleteAlert();
			// 		});
			// 	});
			// } else {
				$scope.importing = false;
				showSuccessfullyCompleteAlert();
			// }
		});
	};

	function checkMnemonicValid(sMnemonic) {
		return (sMnemonic.split(' ').length % 3 === 0) && Mnemonic.isValid(sMnemonic);
	}

	function getMnemonicKey(sMnemonic) {
		var xPrivKey = new Mnemonic(sMnemonic).toHDPrivateKey();
		return xPrivKey.xprivkey;
	}

	function showError(text) {
		$scope.importing = false;
		$scope.error = text;
		$timeout(function() {
			$scope.$apply();
		});
		return false;
	}

	function showSuccessfullyCompleteAlert() {
		$rootScope.$emit(
			'Local/ShowAlert',
			"Import successfully completed, please restart the application.",
			'fi-check',
			function () {
				if (navigator && navigator.app) {
					navigator.app.exitApp();
				} else if (process.exit) {
					process.exit();
				}
			}
		);
	}
}
