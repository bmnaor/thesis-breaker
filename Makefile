.PHONY: install test conformance demo analyze clean-demo
install:
	npm install
test:
	npm test
conformance:
	npm run conformance
demo:
	npm run demo
analyze:
	npx tsx src/cli.ts analyze --fixture fixtures/zura-2026-10-22
clean-demo:
	rm -rf .thesis-breaker logs/run-*.json
