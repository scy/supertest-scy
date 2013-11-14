var sts = require("../index.js"),
    assert = require("assert");

describe("a string with random length", function () {
	it("should not be shorter or longer than allowed", function () {
		for (var i = 0; i < 10000; i++) {
			var min = Math.floor(Math.random() * 10);
			var max = Math.floor(Math.random() * 30) + min;
			var string = sts.generateRandomLengthString(min, max, "abcdefgh");
			assert(string.length >= min, "the string '" + string + "' is shorter than " + min + "characters");
			assert(string.length <= max, "the string '" + string + "' is longer than " + max + "characters");
		}
	});
	it("should not neglect any of the characters in its set", function () {
		var chars = "abcdefgh";
		var neglected = chars;
		for (var i = 0; i < 10000; i++) {
			var min = Math.floor(Math.random() * 10);
			var max = Math.floor(Math.random() * 30) + min;
			var string = sts.generateRandomLengthString(min, max, chars);
			for (var p = 0; p < string.length; p++) {
				neglected = neglected.replace(string.charAt(p), "");
			}
		}
		assert(neglected.length == 0, "these characters were neglected: " + neglected);
	});
});

describe("a conservative domain", function () {
	it("should not have parts that start or end with a hyphen-minus", function () {
		for (var i = 0; i < 10000; i++) {
			var domain = sts.generateConservativeDomain();
			assert(!domain.match(/(?:^|\.)-/), "the domain " + domain + " has a part that starts with a hyphen-minus");
			assert(!domain.match(/-(?:$|\.)/), "the domain " + domain + " has a part that ends with a hyphen-minus");
		}
	});
	it("should not have a single-letter TLD", function () {
		for (var i = 0; i < 10000; i++) {
			var domain = sts.generateConservativeDomain();
			assert(!domain.match(/\..$/), "the domain " + domain + " has a single-letter TLD");
		}
	});
});

describe("a conservative email address", function () {
	it("should not have a local part with standard-violating full stops", function () {
		for (var i = 0; i < 10000; i++) {
			var email = sts.generateConservativeEmail();
			var localpart = email.replace(/@.*$/, "");
			assert(localpart.length, "the address " + email + " has no local part");
			assert(!localpart.match(/^\./), "the local part of " + email + " starts with a full stop");
			assert(!localpart.match(/\.$/), "the local part of " + email + " ends with a full stop");
			assert(!localpart.match(/\.\./), "the local part of " + email + " contains more than one consecutive full stop");
		}
	})
});
