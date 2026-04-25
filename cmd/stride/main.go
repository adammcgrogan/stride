package main

import (
	"log"

	"stride/internal/config"
	"stride/internal/db"
	"stride/internal/server"
	"stride/internal/sync"
)

func main() {
	cfg := config.Load()

	database, err := db.New(cfg.DBPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	syncer := sync.New(cfg, database)
	go syncer.Start()

	srv := server.New(cfg, database, syncer)
	log.Printf("listening on %s", cfg.Addr)
	if err := srv.Start(); err != nil {
		log.Fatalf("server: %v", err)
	}
}
