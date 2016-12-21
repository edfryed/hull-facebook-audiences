import assert from "assert";
import FIXTURES from "./fixtures";
import FacebookAudience from "../server/facebook-audience";
import { spy } from "sinon";
import _ from "lodash";

describe("FacebookAudiences.flushUserUpdates", () => {
  it("should call audience ops", (done) => {
    const fakeAgent = {
      getOrCreateAudienceForSegment: segment => Promise.resolve(segment),
      removeUsersFromAudience: spy(),
      addUsersToAudience: spy()
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
