export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p id={id} className="text-danger-700 text-[13px] font-semibold">
      {message}
    </p>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-field bg-danger-100 text-danger-700 px-4 py-3 text-[15px] font-semibold"
    >
      {message}
    </p>
  );
}
