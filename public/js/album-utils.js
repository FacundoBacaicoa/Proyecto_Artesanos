// album-utils.js
document.addEventListener('DOMContentLoaded', function () {
  // Valida el archivo antes de enviar el formulario de imágenes
  document.querySelectorAll('form[action="/images/upload"]').forEach(form => {
    const fileInput = form.querySelector('input[type="file"][name="image"]');
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn && fileInput) {
      submitBtn.disabled = true;

      fileInput.addEventListener('change', () => {
        submitBtn.disabled = fileInput.files.length === 0;
      });

      form.addEventListener('submit', (e) => {
        if (fileInput.files.length === 0) {
          e.preventDefault();
          alert('Debes seleccionar una imagen para subir.');
        }
      });
    }
  });

  // Maneja los comentarios de las imágenes
  document.querySelectorAll('.comment-form').forEach(form => {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const imageId = form.getAttribute('data-image-id');
      const content = form.querySelector('input[name="content"]').value;

      if (!content.trim()) return;

      try {
        const res = await fetch(`/images/comment/${imageId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });

        if (res.ok) {
          const comments = await res.json();
          const list = document.getElementById('comments-list-' + imageId);
          if (list) {
            list.innerHTML = comments.map(cmt => `
              <li class="mb-2 border-bottom pb-2">
                <div class="d-flex align-items-center gap-2 mb-1">
                  ${cmt.image_profile
                    ? `<img src="${cmt.image_profile}" class="rounded-circle" style="width: 28px; height: 28px; object-fit: cover;">`
                    : `<span class="bg-secondary text-white rounded-circle d-inline-flex justify-content-center align-items-center" style="width: 28px; height: 28px;"><i class="bi bi-person"></i></span>`
                  }
                  <strong>${cmt.name} ${cmt.last_name}</strong>
                  <small class="text-muted ms-2">${new Date(cmt.created_time).toLocaleString()}</small>
                </div>
                <span>${cmt.content}</span>
              </li>
            `).join('');
          }
          form.reset();
        } else {
          alert('No se pudo agregar el comentario.');
        }
      } catch (error) {
        alert('Error al enviar el comentario.');
      }
    });
  });
});