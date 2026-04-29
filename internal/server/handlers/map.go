package handlers

import "net/http"

func (h *Handler) Map(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePage(w, r); !ok {
		return
	}
	h.templates["map"].ExecuteTemplate(w, "layout", nil)
}
