import crypto from "crypto";
import _ from "lodash";

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
    if (!value) {
      return "";
    }
    return crypto.createHash("sha256")
      .update(value.toLowerCase())
      .digest("hex");
  }

  getExtractFields() {
    return _.keys(this.matches);
  }

  buildCustomAudiencePayload(users) {
    let schema = [];
    const data = users.map((user) => {
      const userData = [];
      _.forEach(this.matches, (fbKey, hull) => {
        if (_.has(user, hull) || _.find(schema, fbKey)) {
          schema = _.union(schema, [fbKey]);
          userData.push(this.hashValue(_.get(user, hull)));
        }
      });
      return userData;
    }, []);

    return { schema, data };
  }
}
