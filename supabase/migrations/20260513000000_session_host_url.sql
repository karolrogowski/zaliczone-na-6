-- Whereby Embedded rozróżnia URL uczestnika (roomUrl) i hosta (hostRoomUrl).
-- Przechowujemy oba: daily_room_url = uczestnik, host_room_url = host (korepetytor).
alter table sessions add column if not exists host_room_url text;