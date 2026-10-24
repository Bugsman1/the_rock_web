import { startTransition, useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { useTranslations } from "use-intl";
import { useToast } from "./Toast";

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

type SaveFailure = {
  message?: string;
  unknown?: true;
};

type SaveResultFailure = {
  failed: boolean;
  message?: string;
  unknown?: true;
};

function useReloadAfterRejection() {
  const { revalidate } = useRevalidator();
  const toast = useToast();
  const recordChanged = useTranslations("common")("recordChanged");
  const reloading = useRef(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    reloading.current = false;
  }, [reloads]);

  useEffect(
    () => () => {
      if (reloading.current) {
        toast(recordChanged, "danger");
      }
    },
    [toast, recordChanged],
  );

  return async () => {
    reloading.current = true;
    await revalidate();
    startTransition(() => setReloads((count) => count + 1));
  };
}

export function useSaveFailure() {
  const [failure, setFailure] = useState<SaveFailure>();
  const reloadAfterRejection = useReloadAfterRejection();

  return {
    failure,
    unknown: failure?.unknown === true,
    clear: () => setFailure(undefined),
    fail: () => setFailure({}),
    report: (result: SaveResultFailure) => {
      if (!result.failed) {
        setFailure(undefined);
        void reloadAfterRejection();
        return;
      }

      const next: SaveFailure = {};

      if (result.message !== undefined) next.message = result.message;
      if (result.unknown === true) next.unknown = true;

      setFailure(next);

      if (result.unknown !== true) {
        void reloadAfterRejection();
      }
    },
  };
}

export function SaveFailureMessage({ failure }: { failure: SaveFailure | undefined }) {
  const common = useTranslations("common");

  if (failure === undefined) {
    return null;
  }

  return (
    <FormError
      message={
        failure.unknown === true ? common("saveUnknown") : (failure.message ?? common("saveFailed"))
      }
    />
  );
}
