// These are just some quick extensions to supertest. More documentation and a cleanup to come.

// We provide everything supertest provides.
var supertest = require('supertest');

// An array of HTTP methods SuperAgent supports.
var methods = require("methods");

// Hook into the HTTP methods in order to keep track of the current request. This is of course terribly non-async, but
// seems to work quite well in practice. And I'm doing that to later be able to change the stack trace of any failed
// tests to a dump of the request that was running.
// Note that it seems to be quite hard to do this event-based, since the request's "end" event appears to occur _after_
// the test's "fail" event.
var currentRequest = null, requestNumber = 0;
var exp = module.exports = function () {
	// If somebody calls supertest-scy(), call supertest().
	var agent = supertest.apply(this, arguments);
	// Hook into the methods.
	methods.forEach(function (method) {
		method = (method == "delete") ? "del" : method; // SuperAgent does that as well ("delete" is reserved in JS).
		// Wrap the call.
		agent[method] = (function (orig) {
			return function () {
				// Call the original and keep track of the returned request.
				var request = orig.apply(this, arguments);
				requestNumber++;
				currentRequest = request;
				return request;
			};
		})(agent[method]);
	});
	return agent;
};
// Glue the original supertest properties to our own export.
for (var key in supertest) {
	exp[key] = supertest[key];
}

// We also use tv4 for JSON Schema validation. It's exported for others to use.
var tv4 = exp.tv4 = require('tv4');

var defaultCredentials = { user: null, pass: null };

exp.defaultCredentials = function (user, pass) {
	user = (typeof user == "string") ? user : null;
	pass = (typeof pass == "string") ? pass : null;
	return defaultCredentials = { user: user, pass: pass };
};

var legalTldChars = 'abcdefghijklmnopqrstuvwxyz';
var legalDomainStartEndChars = legalTldChars + '1234567890';
var legalDomainChars = legalDomainStartEndChars + '-';

var legalConservativeLocalPartChars = 'abcdefghijklmnopqrstuvwxyz01234567890-._';
var legalLiberalLocalPartChars = '+^';

exp.getRandomChar = function (choices) {
	return choices.charAt(Math.floor(Math.random() * choices.length));
};

exp.generateRandomString = function (length, start, mid, end) {
	var res = '';
	mid = (typeof mid == 'undefined') ? start : mid;
	end = (typeof end == 'undefined') ? mid : end;
	if (length >= 1) {
		res += exp.getRandomChar(start);
		length--;
	}
	while (length >= 2) {
		res += exp.getRandomChar(mid);
		length--;
	}
	if (length >= 1) {
		res += exp.getRandomChar(end);
	}
	return res;
};

exp.generateRandomLengthString = function (min, max, start, mid, end) {
	var span = max - min;
	var length = Math.floor(Math.random() * (span + 1)) + min;
	return exp.generateRandomString(length, start, mid, end);
};

exp.generateConservativeDomain = function () {
	var parts = [];
	parts.push(exp.generateRandomLengthString(3, 25, legalDomainStartEndChars, legalDomainChars, legalDomainStartEndChars));
	parts.push(exp.generateRandomLengthString(2, 3, legalTldChars));
	return parts.join('.');
};

exp.generateLiberalDomain = function () {
	var parts = [], count = Math.floor(Math.random() * 5) + 1;
	for (var i = 0; i < count; i++) {
		parts.push(exp.generateRandomLengthString(2, 25, legalDomainStartEndChars, legalDomainChars, legalDomainStartEndChars));
	}
	return parts.join('.');
};

exp.generateConservativeEmail = function () {
	// generateRandomLengthString() is not flexible enough to ensure all RFC rules for email
	// addresses are considered, so let's simply run it until we find one that's okay.
	// (Consecutive dots or dots at the beginning or end are a problem.)
	var localpart = '';
	do {
		localpart = exp.generateRandomLengthString(3, 25, legalConservativeLocalPartChars);
	} while (localpart.match(/\.{2,}/) || localpart.match(/^\./) || localpart.match(/\.$/))
	return localpart + "@" + exp.generateConservativeDomain();
};

// Use .end(supertest.debug(done)) to get this.
exp.debug = function (done) {
	return function (err, ag) {
		var done_result = done.apply(this, arguments);
		console.log("\n\n===== ADDITIONAL DEBUGGING INFORMATION =====\n");
		if (err) {
			console.log(err);
		} else {
			console.log('No error.');
		}
		console.log("\n" + ag.req._header);
		console.log(ag.res.statusCode);
		console.log(ag.res.headers);
		console.log(ag.res.text);
		return done_result;
	};
};

/**
 * Extract the interesting information from a request object and create a string out of it.
 *
 * The body will be cut to be no longer than maxBodyDump.
 *
 * @param {object} req The request to convert to a string.
 * @param {number} [number] If supplied, a number to label the request with. (I.e. a simple counter.)
 * @returns {string} The converted request.
 */
var renderRequest = function (req, number) {
	var outnumber = (typeof number == "undefined") ? "" : (" #" + number);
	if (!req) {
		return "===== NO DATA FOR REQUEST" + outnumber + " =====";
	}
	var out = "===== REQUEST" + outnumber + " =====\n";
	out += (req.req && req.req._header) ? req.req._header.replace(/\r/, "") : "[no header data available]\n\n";
	if (req._data) {
		out += "===== SUPPLIED DATA =====\n" + JSON.stringify(req._data, null, 2) + "\n\n";
	}
	if (!req.res) {
		return out + "===== NO RESPONSE DATA AVAILABLE =====";
	}
	out += "===== RESPONSE =====\nHTTP/" + req.res.httpVersion + " " + req.res.statusCode + "\n";
	for (var key in req.res.headers) {
		out += key + ": " + req.res.headers[key] + "\n";
	}
	var body = req.res.text;
	out += "\n";
	if (body.length <= maxBodyDump) {
		if ((req.res.headers["content-type"] || "") == "application/json") {
			out += JSON.stringify(JSON.parse(body), null, 2);
		} else {
			out += body;
		}
	} else {
		out += body.substr(0, maxBodyDump) + "…";
	}
	return out;
};

/**
 * Call renderRequest() with the current request and number.
 *
 * @returns {string} The converted request.
 */
exp.renderCurrentRequest = function () {
	return currentRequest ? renderRequest(currentRequest, requestNumber) : "";
}

var maxBodyDump = 500;
/**
 * Set how many body characters will be included in dumps generated by renderRequest().
 *
 * If the body is longer, it will be cut after this many characters and end with an ellipsis character (…). Default
 * setting is 500.
 *
 * @param {number} size A positive integer specifying the maximum number of characters. Specify Infinity to always
 * include the complete body.
 * @returns {number} The limit that has been set. Either a positive integer or Infinity.
 */
exp.setMaxBodyDump = function (size) {
	return maxBodyDump = (size === Infinity) ? size : parseInt(size, 10);
}

/**
 * Set the error's stack trace to a dump of the current request.
 *
 * Because nobody needs stack traces in SuperTests.
 *
 * @param {Error} err The error to set the stack trace of.
 * @return {Error} The error that has been supplied as a parameter.
 */
var attachCurrentRequestToError = function (err) {
	// Do nothing if there is no current request.
	if (!currentRequest) {
		return err;
	}
	err.request = currentRequest;
	// Keep the original stack trace, but append a request dump to it, indented by four spaces.
	err.stack = (err.stack ? err.stack + "\n\n" : "") + exp.renderCurrentRequest().replace(/^/gm, "    ");
	return err;
};

// Get the Test prototype, because we're going to enhance it! \o/
var Test = exp.Test;

// Sets the HTTP Basic auth header.
Test.prototype.auth = function (user, pass) {
	user = (typeof user == "string") ? user : defaultCredentials.user;
	pass = (typeof pass == "string") ? pass : defaultCredentials.pass;
	if (typeof user != "string") throw new Error("No user set");
	if (typeof pass != "string") throw new Error("No password set");
	return this.set("Authorization", "Basic " + new Buffer(user + ":" + pass).toString("base64"));
};

// Send data with type form, else it would default to JSON.
Test.prototype.sendForm = function (data) {
	return this.type('form').send(data);
};

// Register a JSON schema the result has to match against.
Test.prototype.expectSchema = function (schema, e) {
	if (!this._schemas) this._schemas = [];
	this._schemas.push(schema);
	if (typeof e == 'function') this.end(e);
	return this;
};

// Extend Test's assert() method in order to do the JSON Schema tests.
(function (oldAssert) {
	Test.prototype.assert = function (res, fn) {
		// We need to fake "fn" when passing it to the original assert, to find
		// out what it has been called with.
		// Note that we cannot do something like fn_args = oldAssert.apply() here and "return arguments"
		// in the function body, since oldAssert doesn't always return fn's return value. :(
		var fn_args = undefined;
		// Additionally, we want to catch errors thrown by fn and attach our request to them.
		var self = this;
		var applyFn = function () {
			try {
				return fn.apply(self, fn_args);
			} catch (e) {
				throw attachCurrentRequestToError(e);
			}
		};
		// Run the old assert and record the arguments the callback was called with.
		oldAssert.apply(this, [res, function () { fn_args = arguments; }]);
		// If it received an error, we simply attach the request, pass that to the _real_ fn and are done.
		if (fn_args.length > 0 && fn_args[0]) {
			attachCurrentRequestToError(fn_args[0]);
			return applyFn();
		}
		// If everything else was fine, it's time to do some work.
		// But only if there are schemas defined. ;)
		if (!this._schemas) return applyFn();
		for (var i = 0; i < this._schemas.length; i++) {
			if (!tv4.validate(res.body, this._schemas[i])) {
				var e = tv4.error;
				return fn(attachCurrentRequestToError(new Error(
					'schema validation failed (' + e.code + ', dpath ' + e.dataPath + ', spath ' + e.schemaPath + '): '
					+ e.message + (e.subErrors ? "; subErrors:\n" + JSON.stringify(e.subErrors, null, 2) : "")
				)), res);
			}
		}
		return applyFn();
	};
})(Test.prototype.assert);
