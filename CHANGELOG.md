# CHANGELOG

## v0.3.2
- fix the status bubble up to prevent duplicates

## v0.3.1
- bubble up selected errors to connector status feed

## v0.3.0
- upgrade FB API to v3.1
- upgrade hull-node to 0.13.16
- add new setting `synchronized_segments_mapping`  to replace `synchronized_segments`. If new one is not provided old one will be used, but no new custom audience can be created
- require `customer_file_source` on `synchronized_segments_mapping`
- improve error logging
- make the Credentials screen big

## v0.2.3
- make sure we are deduplicating segments correctly

## v0.2.2
- limit `customaudiences` request to 500 instead of 100

## v0.2.1
- introduce simple `/status` endpoint
- remove import/export
- other maintenance upgrades

## v0.2.0
- migrated to `/smart-notifier` endpoint
- added more logging
- added information about missing audience size

## v0.1.8
- fix newrelic instrumentation

## v0.1.7
- don't skip users without emails
- fix segment:update handler

## v0.1.6
- upgrade FB API to v2.11
- upgrade hull-node to 0.13.10
- supporting tools upgrade

## v0.1.5

- improve error handling
- upgrade to hull-node@0.13.4

## v0.1.4

- updated documentation
- new pictures

## v0.1.3

- fix the way we build payload

## v0.1.2

- upgrade to hull-node@0.12.0
- implement logging convention

## v0.1.1

- upgrade to hull-node@0.11.4

## v0.1.0

- upgrade to hull-node@0.11.0
- adds segment filtering
