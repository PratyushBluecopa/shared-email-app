import { useEffect, useRef } from "react";
import { copaUtils, copaGetConfig } from "@bluecopa/react";
import { useAppContext } from "~/contexts/app-context";

interface UseEmailWebSocketOptions {
  onMessageNew?: (data: any) => void;
  onConversationUpdate?: (data: any) => void;
}

/** Subscribes to the email engine's real-time channel (Pusher by default). */
export function useEmailWebSocket({ onMessageNew, onConversationUpdate }: UseEmailWebSocketOptions) {
  const wsProviderRef = useRef<any>(null);
  const onMessageNewRef = useRef(onMessageNew);
  const onConversationUpdateRef = useRef(onConversationUpdate);
  const { user, envConfig } = useAppContext();
  const userId = user?.userId ?? "";

  // Channel / event names and provider settings come from env (host `envVars`
  // win), so the backend publisher and this subscriber stay aligned without
  // code edits. Any change re-establishes the subscription.
  const CHANNEL = envConfig.VITE_EMAIL_WS_CHANNEL;
  const EVENT_MESSAGE_NEW = envConfig.VITE_EMAIL_WS_EVENT_MESSAGE_NEW;
  const EVENT_CONVERSATION_UPDATE = envConfig.VITE_EMAIL_WS_EVENT_CONVERSATION_UPDATE;
  const mechanism = envConfig.VITE_WEBSOCKET || "pusher";
  const pusherKey = envConfig.VITE_PUSHER_KEY;
  const pusherCluster = envConfig.VITE_PUSHER_CLUSTER;
  const authEndpoint = envConfig.VITE_PUSHER_AUTH_ENDPOINT;

  useEffect(() => {
    onMessageNewRef.current = onMessageNew;
    onConversationUpdateRef.current = onConversationUpdate;
  }, [onMessageNew, onConversationUpdate]);

  useEffect(() => {
    if (!userId) return;
    if (!CHANNEL || !EVENT_MESSAGE_NEW || !EVENT_CONVERSATION_UPDATE) {
      console.warn("[Email WS] Missing channel / event config; skipping subscription");
      return;
    }

    try {
      const config = copaGetConfig();
      if (!config.accessToken) return;
      const factory = copaUtils?.websocketUtils?.WebsocketContextFactory;
      if (!factory) {
        console.warn("[Email WS] WebsocketContextFactory not available");
        return;
      }

      const provider = factory.create(mechanism as "pusher" | "centrifugo", {
        userId,
        token: config.accessToken,
        pusherKey,
        pusherCluster,
        ...(authEndpoint ? { authenticationEndpoint: authEndpoint } : {}),
      });
      if (!provider) {
        console.warn("[Email WS] WebsocketContextFactory.create returned null");
        return;
      }
      wsProviderRef.current = provider;

      provider.bind(CHANNEL, EVENT_MESSAGE_NEW, (data: any) => onMessageNewRef.current?.(data));
      provider.bind(CHANNEL, EVENT_CONVERSATION_UPDATE, (data: any) => onConversationUpdateRef.current?.(data));
    } catch (error) {
      console.error("[Email WS] Failed to connect:", error);
    }

    return () => {
      try {
        wsProviderRef.current?.disconnect();
      } catch (error) {
        console.error("[Email WS] Disconnect error:", error);
      }
      wsProviderRef.current = null;
    };
  }, [userId, CHANNEL, EVENT_MESSAGE_NEW, EVENT_CONVERSATION_UPDATE, mechanism, pusherKey, pusherCluster, authEndpoint]);
}
