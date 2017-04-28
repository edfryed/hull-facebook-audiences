import crypto from "crypto";
import _ from "lodash";
import countryData from "country-data";

/**
 * @see https://developers.facebook.com/docs/marketing-api/custom-audience-api/v2.8
 */
export default class CustomAudiences {

  constructor(ship, logger) {
    this.ship = ship;
    this.logger = logger;
    /**
     * Defines relations between possible Facebook audiences and manifest settings
     * @see  https://developers.facebook.com/docs/marketing-api/custom-audience-api/v2.8#hash
     * @type {Object}
     */
    this.matches = {
      "EMAIL": "field_email",
      "FN": "field_first_name",
      "LN": "field_last_name",
      "PHONE": "field_phone",
      "GEN": "field_gender",
      "ST": "field_state",
      "CT": "field_city",
      "COUNTRY": "field_country",
    };
  }

  hashValue(value) {
    if (!value) {
      return "";
    }
    return crypto.createHash("sha256")
      .update(value)
      .digest("hex");
  }

  /**
   * @return {Array} array of Hull traits
   */
  getExtractFields() {
    return _(this.matches)
      .values()
      .map(this.getHullTrait.bind(this))
      .filter()
      .value();
  }

  getHullTrait(settingKey) {
    return _.get(this.ship.private_settings, settingKey);
  }

  /**
   * @param  {Array} users array of Hull Users
   * @return {Object} { schema, data }
   */
  buildCustomAudiencePayload(users) {
    let schema = [];
    const data = users.map((user) => {
      const userData = [];
      _.forEach(this.matches, (settingKey, fbKey) => {
        const hull = this.getHullTrait(settingKey);
        if (hull && (_.has(user, hull) || _.find(schema, fbKey))) {
          schema = _.union(schema, [fbKey]);
          let value = _.get(user, hull);

          if (_.isArray(value)) {
            return;
          }

          if (this[`normalize${_.upperFirst(fbKey.toLowerCase())}`]) {
            value = this[`normalize${_.upperFirst(fbKey.toLowerCase())}`](value);
          }
          value = _.trim(value).toLowerCase();
          this.logger.debug(fbKey, value);
          userData.push(this.hashValue(value));
        }
      });
      return userData;
    }, []);

    return { schema, data };
  }

  normalizeFn(value) {
    return (value || "").replace(/[^a-z\s\u00C0-\u017F+]+/gi, "");
  }

  normalizeLn(value) {
    return (value || "").replace(/[^a-z\s\u00C0-\u017F+]+/gi, "");
  }

  normalizeCt(value) {
    return (value || "").replace(/[^a-z\s\u00C0-\u017F+]+/gi, "");
  }

  /**
   * Removes leading zeroes and every other charactes than numbers and spaces
   * @param  {String} value
   * @return {String}
   */
  normalizePhone(value) {
    return _.trimStart((value || "").replace(/[^0-9\s+]+/gi, ""), "0");
  }

  /**
   * TODO: should return `f` or `m`
   * @param  {String} value
   * @return {String}
   */
  normalizeGen(value) {
    return value;
  }

  /**
   * TODO: should return 2-character ANSI abbreviation code
   * @param  {String} value
   * @return {String}
   */
  normalizeSt(value) {
    return value;
  }

  /**
   * TODO: try to convert the country to 2 letters ISO code
   * @param  {String} country
   * @return {String}
   */
  normalizeCountry(country) {
    if (countryData.lookup.countries({
      alpha2: country
    })) {
      return country;
    }
    return country;
  }
}
