.PHONY: deb publish_deb tag deletetag test clean

SHELL := /bin/bash

VERSION := $(shell cat package.json | jq .version)
CURR_HASH := $(shell echo "$$(git rev-list --pretty=%h --max-count=1 HEAD | grep -v ^commit)")

release: tag
	npm publish --access=public

tag:
	git tag -a $(VERSION) -m "Release version: $(VERSION)"
	git push origin $(VERSION)

deletetag:
	git tag -d $(VERSION)
	git push origin :refs/tags/$(VERSION)

version:
	@echo $(VERSION)
