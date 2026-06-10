SERVER := root@192.168.7.17
REMOTE_DIR := /opt/world-cup-sweepstake

.PHONY: deploy sync restart logs ps status

deploy: sync
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose up -d --build"

sync:
	rsync -avz --delete \
		--exclude '.env' \
		--exclude 'node_modules' \
		--exclude '.git' \
		--exclude '*.md' \
		--exclude '.gitkeep' \
		--exclude '.husky' \
		--exclude 'mockups' \
		--exclude 'tasks' \
		./ $(SERVER):$(REMOTE_DIR)/

restart:
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose restart"

logs:
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose logs -f"

ps:
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose ps"

status:
	@echo "=== containers ==="
	ssh $(SERVER) "cd $(REMOTE_DIR) && docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'"
	@echo ""
	@echo "=== health ==="
	@curl -s -o /dev/null -w "HTTP %{http_code}\n" http://192.168.7.17:3001 || echo "unreachable"
