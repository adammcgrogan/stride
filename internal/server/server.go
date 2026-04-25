package server

import (
	"net/http"

	"stride/internal/config"
	"stride/internal/db"
	"stride/internal/server/handlers"
	"stride/internal/sync"
)

type Server struct {
	cfg    *config.Config
	db     *db.DB
	syncer *sync.Syncer
	mux    *http.ServeMux
}

func New(cfg *config.Config, db *db.DB, syncer *sync.Syncer) *Server {
	s := &Server{cfg: cfg, db: db, syncer: syncer, mux: http.NewServeMux()}
	s.routes()
	return s
}

func (s *Server) routes() {
	h := handlers.New(s.cfg, s.db, s.syncer)

	s.mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("web/static"))))
	s.mux.HandleFunc("/auth/login", h.AuthLogin)
	s.mux.HandleFunc("/auth/callback", h.AuthCallback)
	s.mux.HandleFunc("/activities/", h.ActivityDetail)
	s.mux.HandleFunc("/activities", h.Activities)
	s.mux.HandleFunc("/stats", h.Stats)
	s.mux.HandleFunc("/api/activities", h.APIActivities)
	s.mux.HandleFunc("/", h.Dashboard)
}

func (s *Server) Start() error {
	return http.ListenAndServe(s.cfg.Addr, logging(s.mux))
}
