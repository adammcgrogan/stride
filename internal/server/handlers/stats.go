package handlers

import "net/http"

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePage(w, r); !ok {
		return
	}
	h.templates["stats"].ExecuteTemplate(w, "layout", nil)
}
