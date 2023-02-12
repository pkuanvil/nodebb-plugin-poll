'use strict';

define('admin/plugins/poll', ['settings'], function (Settings) {
	var wrapper;

	var ACP = {};

	ACP.init = function () {
		wrapper = $('.poll-settings');

		Settings.sync('poll', wrapper);

		$('#save').on('click', function () {
			save();
		});

		$('#reset').on('click', function () {
			reset();
		});
	};

	function save() {
		Settings.save('poll', wrapper);
	}

	function reset() {
		bootbox.confirm('Are you sure you wish to reset the settings?', function (sure) {
			if (sure) {
				socket.emit('admin.plugins.poll.getDefaults', null, function (err, data) {
					if (err) {
						console.error(err);
					}
					Settings.set('poll', data, wrapper);
				});
			}
		});
	}

	return ACP;
});
