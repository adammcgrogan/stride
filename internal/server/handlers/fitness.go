package handlers

import "net/http"

func (h *Handler) Fitness(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePage(w, r); !ok {
		return
	}
	h.templates["fitness"].ExecuteTemplate(w, "layout", nil)
}
