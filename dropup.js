(function($) {
$.fn.dropup = function($o) {
	var _o = $.extend({}, $.fn.dropup.opts, $o);

	_o.max_file_size = _o.max_file_size * 1048576;
	this.get(0).addEventListener('drop', $.fn.dropup.drop_handler, true);

	$(this).bind('dragenter dragover dragleave',
		$.fn.dropup.local_handlers);

	$('body').bind('drop dragenter dragover dragleave',
		$.fn.dropup.global_handlers);

	$.fn.dropup.opts = _o;

	return true;
};

$.fn.dropup.opts = {
	url: '',
	name: 'file',
	max_files: 15,
	max_file_size: 15,
	good_count: 0,
	bad_count: 0,
	on_before_start: function($f) { return true; },
	error: function($code, $f) {
		alert($code + (!$f ? '' : ': ' + $f));
	}
};

$.fn.dropup.local_handlers = function($e) {
	var _o = $.fn.dropup.opts;
	switch ($e.type) {
		case 'dragenter':
			clearTimeout(_o.timer);
			$e.preventDefault();
			if ($.isFunction(_o.on_enter)) { _o.on_enter($e); }
			break;
		case 'dragover':
			clearTimeout(_o.timer);
			$e.preventDefault();
			if ($.isFunction(_o.on_g_over)) { _o.on_g_over($e); }
			if ($.isFunction(_o.on_over)) { _o.on_over($e); }
			break;
		case 'dragleave':
			clearTimeout(_o.timer);
			if ($.isFunction(_o.on_leave)) { _o.on_leave($e); }
			$e.stopPropagation();
			break;
	}
	return false;
};

$.fn.dropup.global_handlers = function($e) {
	var _o = $.fn.dropup.opts;
	switch ($e.type) {
		case 'dragenter':
			clearTimeout(_o.timer);
			$e.preventDefault();
			if ($.isFunction(_o.on_g_enter) && !_o.docenter) {
				_o.docenter = true;
				_o.on_g_enter($e);
			}
			break;
		case 'dragover':
			clearTimeout(_o.timer);
			$e.preventDefault();
			if ($.isFunction(_o.on_g_over)) { _o.on_g_over($e); }
			break;
		case 'dragleave':
			_o.timer = setTimeout(function() {
				if ($.isFunction(_o.on_g_leave)) { _o.on_g_leave($e); }
			},200);
			break;
		case 'drop':
			if ($.isFunction(_o.on_g_leave)) { _o.on_g_leave($e); }
			_o.docenter = false;
			break;
	}
	return false;
};

$.fn.dropup.drop_handler = function($e) {
	var _o = $.fn.dropup.opts;
	if ($.isFunction(_o.on_drop)) {
		_o.on_drop($e);
	}

	$.fn.dropup.upload($e.dataTransfer.files);
	$e.preventDefault();
	return false;
};

$.fn.dropup.upload = function($files) {
	var _i,
		_o = $.fn.dropup.opts;

	if (!$files) {
		_o.error(201, 'Browser does not support drag-n-drop');
		return false;
	}

	if ($files.length > _o.max_files) {
		_o.error(202, 'Only ' + _o.max_files + ' files allowed');
		_o.good_count = 0;
		_o.bad_count = 0;
		_o.on_complete();
		return false;
	}

	for (_i = 0; _i < $files.length; _i++) {
		if (_o.abort) {
			return false;
		}

		try {
			if (_o.on_before_start($files[_i]) !== false) {
				if (_i === $files.length) {
					return true;
				}

				var _reader = new FileReader();

				_reader.index = _i;
				_reader.file = $files[_i];
				_reader.len = $files.length;

				if (_reader.file.size > _o.max_file_size) {
					_o.error(203,
						_reader.file.size + ' is larger than ' +
						_o.max_file_size);
					_o.bad_count++;
					if (_o.bad_count + _o.good_count === $files.length) {
						_o.on_complete();
						_o.good_count = 0; _o.bad_count = 0;
					}
				} else {
					_reader.onloadend = this.send_handler;
					_reader.readAsBinaryString($files[_i]);
				}
			} else {
				_o.bad_count++;
			}
		} catch ($err) {
			_o.error(201, $err);
			return false;
		}
	}
	return true;
};

$.fn.dropup.send_handler = function($e) {
	var _o = $.fn.dropup.opts;

	var _xhr = new XMLHttpRequest(),
		_u = _xhr.upload,
		_file = $e.target.file,
		_idx = $e.target.index;

	_u.index = _idx;
	_u.file = _file;
	_u.progress = 0;
	_u.addEventListener('progress', $.fn.dropup.progress_handler, false);

	_xhr.open('POST', _o.url, true);

	if (window.FormData) {
		var _fd = new FormData();
		$.each(_o.params, function($k) {
			_fd.append($k, this);
		});
		_fd.append(_o.name, $e.target.file);

		_xhr.send(_fd);
	} else if (_file.getAsBinary) {
		var b = '------multipartformboundary' + (new Date).getTime(),
			dd = '--',
			cr = '\r\n',
			_builder = '';

		//$.each(_o.params,function($k){
		//	_builder = dd + b + cr
		//		+ 'Content-Disposition: form-data; name="'+$k+'"'
		//		+ cr + this + cr + dd + b + cr;
		//});

		_builder +=
			dd + b + cr +
			'Content-Disposition: form-data; name="' + _o.name + '"; ' +
			'filename="' + _file.name + '"' + cr +
			'Content-Type: application/octet-stream' +
			cr + cr;

		_builder += _file.getAsBinary();
		_builder += cr + dd + b + cr + dd + b + dd + cr;

		_xhr.setRequestHeader('content-type',
			'multipart/form-data; boundary=' + b);
		_xhr.sendAsBinary(_builder);
	} else {
		_o.error(201, 'Browser not supported!');
		_o.abort = true;
		return false;
	}

	if ($.isFunction(_o.on_start)) {
		_o.on_start(_idx, _file, $e.target.len);
	}

	_xhr.onload = function() {
		if (_xhr.responseText) {
			_o.good_count++;
			var _r = _o.on_finish(_idx, _file, $.parseJSON(_xhr.responseText));

			if (_o.good_count === ($e.target.len - _o.bad_count)) {
				_o.good_count = 0; _o.bad_count = 0;
				_o.on_complete(_o.good_count);
			}

			if (_r === false) {
				_o.abort = true;
			}
		}
	};
	return true;
};

$.fn.dropup.progress_handler = function($e) {
	var _o = $.fn.dropup.opts;
	if (!$e.lengthComputable) {
		return false;
	}

	var _percentage = Math.round(($e.loaded * 100) / $e.total);
	if (this.progress !== _percentage) {
		this.progress = _percentage;
		if ($.isFunction(_o.on_progress)) {
			_o.on_progress(this.index, this.file, this.progress);
		}
	}
	return true;
};
})(jQuery);
