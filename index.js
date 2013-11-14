// These are just some quick extensions to supertest. More documentation and a cleanup to come.

// We provide everything supertest provides.
var supertest = require('supertest');
module.exports = supertest;

// We also use tv4 for JSON Schema validation. It's exported for others to use.
var tv4 = supertest.tv4 = require('tv4');

var defaultCredentials = false;

supertest.defaultCredentials = function (user, pass) {
	defaultCredentials = new Buffer(user + ':' + pass).toString('base64');
};

var legalTldChars = 'abcdefghijklmnopqrstuvwxyz';
var legalDomainStartEndChars = legalTldChars + '1234567890';
var legalDomainChars = legalDomainStartEndChars + '-';

var legalConservativeLocalPartChars = 'abcdefghijklmnopqrstuvwxyz01234567890-._';
var legalLiberalLocalPartChars = '+^';

supertest.getRandomChar = function (choices) {
	return choices.charAt(Math.floor(Math.random() * choices.length));
};

supertest.generateRandomString = function (length, start, mid, end) {
	var res = '';
	mid = (typeof mid == 'undefined') ? start : mid;
	end = (typeof end == 'undefined') ? mid : end;
	if (length >= 1) {
		res += supertest.getRandomChar(start);
		length--;
	}
	while (length >= 2) {
		res += supertest.getRandomChar(mid);
		length--;
	}
	if (length >= 1) {
		res += supertest.getRandomChar(end);
	}
	return res;
};

supertest.generateRandomLengthString = function (min, max, start, mid, end) {
	var span = max - min;
	var length = Math.floor(Math.random() * (span + 1)) + min;
	return supertest.generateRandomString(length, start, mid, end);
};

supertest.generateConservativeDomain = function () {
	var parts = [];
	parts.push(supertest.generateRandomLengthString(3, 25, legalDomainStartEndChars, legalDomainChars, legalDomainStartEndChars));
	parts.push(supertest.generateRandomLengthString(2, 3, legalTldChars));
	return parts.join('.');
};

supertest.generateLiberalDomain = function () {
	var parts = [], count = Math.floor(Math.random() * 5) + 1;
	for (var i = 0; i < count; i++) {
		parts.push(supertest.generateRandomLengthString(2, 25, legalDomainStartEndChars, legalDomainChars, legalDomainStartEndChars));
	}
	return parts.join('.');
};

supertest.generateConservativeEmail = function () {
	return (
		supertest.generateRandomLengthString(3, 25, legalConservativeLocalPartChars)
		+ '@' +
		supertest.generateConservativeDomain()
	);
};

// Use .end(supertest.debug(done)) to get this.
supertest.debug = function (done) {
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

// Get the Test prototype, because we're going to enhance it! \o/
var Test = supertest.Test;

// Sets the HTTP Basic auth header.
Test.prototype.auth = function () {
	return this.set('Authorization', 'Basic ' + defaultCredentials);
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
		var fn_args;
		oldAssert.apply(this, [res, function () { fn_args = arguments; }]);
		// If it received an error, we simply pass that to the _real_ fn and are done.
		if (fn_args.length > 0 && fn_args[0]) {
			return fn.apply(this, fn_args);
		}
		// If everything else was fine, it's time to do some work.
		// But only if there are schemas defined. ;)
		if (!this._schemas) return fn.apply(this, fn_args);
		for (var i = 0; i < this._schemas.length; i++) {
			if (!tv4.validate(res.body, this._schemas[i])) {
				var e = tv4.error;
				return fn(new Error(
					'schema validation failed (' + e.code + ' at ' + e.schemaPath + '): ' + e.message
				), res);
			}
		}
		return fn.apply(this, fn_args);
	};
})(Test.prototype.assert);
