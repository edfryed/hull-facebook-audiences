import assert from "assert";
import FIXTURES from "./fixtures";
import FacebookAudience from "../server/facebook-audience";
import { spy } from "sinon";
import _ from "lodash";

describe("FacebookAudiences.flushUserUpdates", () => {
  it("should call audience ops", (done) => {
    const fakeAgent = {
      ship: {
        private_settings: {
          synchronized_segments: [
            "585a69b2d5536348cf000128", "585a69b2d5536348cf000129"
          ]
        }
      },
      getOrCreateAudienceForSegment: spy(),
      removeUsersFromAudience: spy(),
      addUsersToAudience: spy(),
      fetchAudiences: () => Promise.resolve({
        "585a69b2d5536348cf000128": "test1",
        "585a69b2d5536348cf000129": "test2"
      })
    };

    FacebookAudience
      .flushUserUpdates(fakeAgent, [FIXTURES.user_update], {})
      .then((res) => {
        assert(fakeAgent.removeUsersFromAudience.calledOnce);
        assert(fakeAgent.addUsersToAudience.calledOnce);
      })
      .then(done);
  });
});
