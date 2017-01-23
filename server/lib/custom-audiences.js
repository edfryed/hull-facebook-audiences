import crypto from "crypto";

/**
 * @see https://developers.facebook.com/docs/marketing-api/custom-audience-api/v2.8
 */
export default class CustomAudiences {

  constructor() {
    // matching between Hull traits on the left and FB custom audience keys on the right
    this.matches = {
      email: "EMAIL",
      first_name: "FN",
      last_name: "LN",
      phone: "PHONE",
      address_city: "CT",
      address_country: "COUNTRY",
      address_state: "ST"
    };
  }

  hashValue(value) {
    return crypto.createHash("sha256")
      .update(value.toLowerCase())
      .digest("hex");
  }

  buildPayload(user, schema) {
    const data = [];
    _.forEach(this.matches, (fbKey, hull) => {
      if (_.has(user, hull) || _.find(schema, fbKey)) {
        _.union(schema, [fbKey]);
        data.push(this.hashValue(_.get(user, hull)));
      }
    });
    return data;
  }

  buildCustomAudiencePayload(users) {
    const schema = [];
    const data = users.map((user) => buildPayload(user, schema));
    if (_.isEmpty(data)) {
      return Promise.resolve({ data: [] });
    }

    return { schema, data };
  }
}