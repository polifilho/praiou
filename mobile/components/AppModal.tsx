import React, { createContext, useContext, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

type ModalVariant = "info" | "confirm" | "danger" | "#fb923c";

type AppModalState = {
  visible: boolean;
  title: string;
  message?: string;
  variant: ModalVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (() => void | Promise<void>) | null;
  onCancel?: (() => void) | null;
  busy?: boolean;
};

type ModalAPI = {
  show: (opts: Partial<AppModalState> & { title: string }) => void;
  hide: () => void;
  info: (title: string, message?: string, confirmText?: string) => void;
  confirm: (opts: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ModalVariant;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  }) => void;
};

const Ctx = createContext<ModalAPI | null>(null);

export function useAppModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppModal must be used within <AppModalProvider />");
  return ctx;
}

export function AppModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppModalState>({
    visible: false,
    title: "",
    message: "",
    variant: "info",
    confirmText: "OK",
    cancelText: "Cancelar",
    onConfirm: null,
    onCancel: null,
    busy: false,
  });

  function hide() {
    setState((s) => ({ ...s, visible: false, busy: false }));
  }

  function show(opts: Partial<AppModalState> & { title: string }) {
    setState((s) => ({
      ...s,
      visible: true,
      variant: opts.variant ?? "info",
      title: opts.title,
      message: opts.message ?? "",
      confirmText: opts.confirmText ?? "OK",
      cancelText: opts.cancelText ?? "Cancelar",
      onConfirm: opts.onConfirm ?? null,
      onCancel: opts.onCancel ?? null,
      busy: false,
    }));
  }

  function info(title: string, message?: string, confirmText?: string) {
    show({ title, message, confirmText: confirmText ?? "OK", variant: "info" });
  }

  function confirm(opts: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ModalVariant;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  }) {
    show({
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText ?? "Confirmar",
      cancelText: opts.cancelText ?? "Cancelar",
      variant: opts.variant ?? "confirm",
      onConfirm: opts.onConfirm ?? null,
      onCancel: opts.onCancel ?? null,
    });
  }

  const api = useMemo<ModalAPI>(() => ({ show, hide, info, confirm }), []);

  const colors = useMemo(() => {
    if (state.variant === "danger") return { btn: "#ef4444", btnText: "white" };
    if (state.variant === "confirm") return { btn: "#fb923c", btnText: "white" };
    return { btn: "#fb923c", btnText: "white" };
  }, [state.variant]);

  async function handleConfirm() {
    if (!state.onConfirm) {
      hide();
      return;
    }

    try {
      setState((s) => ({ ...s, busy: true }));
      await state.onConfirm();
      hide();
    } catch {
      // se der erro, mantém aberto e só destrava
      setState((s) => ({ ...s, busy: false }));
    }
  }

  return (
    <Ctx.Provider value={api}>
      {children}

      <Modal
        transparent
        visible={state.visible}
        animationType="fade"
        onRequestClose={hide}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 20 }}>
          {/* clicar fora fecha */}
          <Pressable onPress={hide} style={{ position: "absolute", inset: 0 }} />

          <View style={{ backgroundColor: "white", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>
              {state.title}
            </Text>

            {!!state.message ? (
              <Text style={{ marginTop: 8, color: "#374151", fontWeight: "600", lineHeight: 20 }}>
                {state.message}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              {state.variant !== "info" ? (
                <Pressable
                  onPress={() => {
                    state.onCancel?.();
                    hide();
                  }}
                  disabled={state.busy}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: "#f3f4f6",
                    opacity: state.busy ? 0.6 : 1,
                  }}
                >
                  {state.cancelText &&
                    <Text style={{ fontWeight: "900", color: "#111827" }}>
                        {state.cancelText ?? "Cancelar"}
                    </Text>
                  }  
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleConfirm}
                disabled={state.busy}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: colors.btn,
                  opacity: state.busy ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.btnText }}>
                  {state.busy ? "..." : (state.confirmText ?? "OK")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}
