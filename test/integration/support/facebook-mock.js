import nock from "nock";

module.exports = function mocks() {
  const API_PREFIX = "https://graph.facebook.com/v2.11";
  return {
    setUpGetAudiencesNock: (fulfilled) => {
      if (!fulfilled) {
        return nock(API_PREFIX)
          .get("/act_123/customaudiences")
          .query(true)
          .reply(200, {
            data: [],
            paging: {}
          });
      }

      return nock(API_PREFIX)
        .get("/act_123/customaudiences")
        .query(true)
        .reply(200, {
          data: [
            {
              id: "hullsegment0hullsegment1",
              description: "hullsegment0hullsegment1"
            },
            {
              id: "testsegment0testsegment1",
              description: "testsegment0testsegment1"
            }
          ],
          paging: {}
        });
    },
    setUpCreateAudiencesNock: (audienceId) => nock(API_PREFIX)
      .post("/act_123/customaudiences")
      .query(true)
      .reply(200, {
        id: audienceId
      }),
    setUpCreateUserInAudienceNock: (audienceId, bodyValidator = () => true) => nock(API_PREFIX)
      .post(`/${audienceId}/users`, (body) => bodyValidator(body))
      .query(true)
      .reply(200),
    setUpDeleteUserInAudienceNock: (audienceId) => nock(API_PREFIX)
      .post(`/${audienceId}/users`)
      .query({ method: "delete" })
      .reply(200)
  }
};