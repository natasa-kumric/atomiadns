var request = require('request');

exports.errorMessageMap = {
	'InternalError.UnknownException': "Unknown error",
	'LogicalError.DifferentTTLForSameLabelClassAndType': "You can't have records for the same name and type but with different TTL values"
};

exports.getOperationRequest = function (operation, username, token, password) {
	var uri_base = process.env['ATOMIADNS_SOAP_URI'] != null ? process.env['ATOMIADNS_SOAP_URI'] : "http://127.0.0.1/atomiadns.json/"
	if (uri_base.lastIndexOf('/') != uri_base.length - 1) {
		uri_base += "/";
	}

	var headers_dict = {
		"X-Auth-Username": username
	};

	if (token != null) {
		headers_dict["X-Auth-Token"] = token;
	} else if (password != null) {
		headers_dict["X-Auth-Password"] = password;
	}

	return {
		uri: uri_base + operation,
		headers: headers_dict
	};
};

exports.authenticate = function (username, password, callback) {
	request.post(exports.getOperationRequest("Noop", username, null, password), function (error, res, body) {
		if (error) return callback(error);
		if (res.statusCode == 200) {
			var token = res.headers['x-auth-token'];
			return callback(null, token)
		} else if (res.statusCode >= 401 && res.statusCode <= 403) {
			return callback(null, null);
		} else {
			return callback("authentication failed, status code from rest api was " + res.statusCode);
		}
	});
};

exports.executeOperation = function (req, sres, user, operation, args, callback) {
	if (operation == null || user == null || user.email == null || user.token == null) {
		return callback("invalid input to executeOperation");
	}

	var operationReq = exports.getOperationRequest(operation, user.email, user.token);
	operationReq.body = JSON.stringify(args);

	request.post(operationReq, function (error, res, body) {
		if (error) return callback(error);
		if (res.statusCode == 200) {
			try {
				var operationResponse = JSON.parse(body);
				return callback(null, operationResponse)
			} catch (e) {
				return callback("invalid JSON returned for " + operation);
			}
		} else if (res.statusCode >= 401 && res.statusCode <= 403) {
			req.logout();
			sres.redirect(req.url);
			return;
		} else if (body == null || !body.length) {
			return callback("invalid status for " + operation);
		} else {
			return callback(exports.humanizeError(body));
		}
	});
};

exports.humanizeError = function (error) {
	if (process.env['ATOMIADNS_RAW_ERRORS'] != null && process.env['ATOMIADNS_RAW_ERRORS']) {
		return error;
	}

	try {
		var fault = JSON.parse(error);
		if (fault != null && fault.error_type != null && exports.errorMessageMap[fault.error_type] != null) {
			return exports.errorMessageMap[fault.error_type];
		}
	} catch (e) {
		// Fall through
	}

	return exports.errorMessageMap["InternalError.UnknownException"];
};
