-- Запусти этот SQL в Supabase → SQL Editor → New Query
-- Схема соответствует текущей версии приложения.

-- Магазины
create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_price numeric(10,2) default 0,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Категории расходов (справочник)
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_default boolean default false
);

-- Справочник материалов (для быстрого добавления закупов/расходов)
create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text default 'шт',
  price_per_unit numeric(10,2) default 0,
  category text default '💸 Расходы',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Шаблоны типовых расходов
create table expense_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(10,2) default 0,
  category text default 'Расходы',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Рабочие дни
create table days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  baked integer default 0,            -- сколько лепёшек испекли в этот день
  created_at timestamptz default now()
);

-- Продажи по магазинам за день
create table sales (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references days(id) on delete cascade,
  shop_id uuid references shops(id) on delete cascade,
  quantity integer default 0,
  returns integer default 0,          -- возвраты, шт
  bonus integer default 0,            -- бонусные (бесплатные) лепёшки, шт
  price numeric(10,2) default 0,
  payment_type text check (payment_type in ('Наличка','Каспи')) default 'Наличка',
  unique(day_id, shop_id)
);

-- Расходы за день
create table expenses (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references days(id) on delete cascade,
  name text,
  amount numeric(10,2) default 0,
  category text default '💸 Расходы', -- '📦 Закупы' | '💸 Расходы' | '👷 Зарплата'
  created_at timestamptz default now()
);

-- Дефолтные данные
insert into shops (name, sort_order) values
  ('Магазин 1', 1),
  ('Магазин 2', 2),
  ('Магазин 3', 3);

insert into expense_categories (name, is_default) values
  ('ЗП рабочим', true),
  ('Мука', true),
  ('Масло', true),
  ('Бензин', true),
  ('Прочее', false);

-- Отключаем RLS (т.к. авторизация через пароль/биометрию в приложении)
alter table shops disable row level security;
alter table expense_categories disable row level security;
alter table materials disable row level security;
alter table expense_templates disable row level security;
alter table days disable row level security;
alter table sales disable row level security;
alter table expenses disable row level security;
