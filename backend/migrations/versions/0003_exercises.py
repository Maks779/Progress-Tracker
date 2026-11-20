"""Exercises: the built-in catalog (seeded here) and custom exercises.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-12 16:56:15.649365+00:00
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATALOG = [
    ("81d26d7e-0991-5e3b-9347-1aad468dab07", "bench_press", "chest", "barbell", "compound"),
    ("fd919607-9f37-5d09-a53a-6870fa1f9429", "incline_bench_press", "chest", "barbell", "compound"),
    (
        "6c4c8acd-c2df-5a59-b354-20a847bded30",
        "dumbbell_bench_press",
        "chest",
        "dumbbell",
        "compound",
    ),
    (
        "33b396df-07c9-5dbd-9cee-647238090f2c",
        "incline_dumbbell_press",
        "chest",
        "dumbbell",
        "compound",
    ),
    (
        "8c366d90-3885-5c63-aa08-ab28fd0e3b2a",
        "close_grip_bench_press",
        "chest",
        "barbell",
        "compound",
    ),
    ("be11d201-6763-5e20-9e22-acdc632f3daf", "machine_chest_press", "chest", "machine", "compound"),
    ("a80981c6-2909-5325-90c5-341fcac3a573", "push_up", "chest", "bodyweight", "compound"),
    ("0ee39073-68c3-5a2e-91b9-f734ca415f3d", "dip", "chest", "bodyweight", "compound"),
    ("ac7fd6f0-9e6e-5d04-98f8-e253ba5213af", "chest_fly", "chest", "dumbbell", "isolation"),
    ("fe3d2121-bd6e-57ec-941e-c78653e99f35", "cable_crossover", "chest", "cable", "isolation"),
    ("54b2c8e7-0aaa-5767-b599-b903ef5e7386", "deadlift", "back", "barbell", "compound"),
    ("a8b89a56-4ac4-5ead-9dcf-5f82a46bace0", "barbell_row", "back", "barbell", "compound"),
    ("cdfe028c-2d4f-51d4-afc3-502ad3e2b938", "dumbbell_row", "back", "dumbbell", "compound"),
    ("cd883390-ad35-557b-8df3-57673937bca9", "t_bar_row", "back", "barbell", "compound"),
    ("59272fda-dfe0-559f-ad76-1f64cb6b966c", "pull_up", "back", "bodyweight", "compound"),
    ("a8ca6c08-1447-56b3-9b90-a39ed99a637c", "chin_up", "back", "bodyweight", "compound"),
    ("d5e3dae0-1969-5888-94b9-effe51f4da69", "lat_pulldown", "back", "cable", "compound"),
    ("7275ddc8-b640-59be-bfc7-eec95700260a", "seated_cable_row", "back", "cable", "compound"),
    ("ad4ab04d-9bc4-5a15-9e5c-ba5597e50c46", "face_pull", "back", "cable", "isolation"),
    ("7097a44c-e7f5-5575-b1f6-e7bc44824086", "back_extension", "back", "bodyweight", "isolation"),
    ("d35e9151-8367-5c4c-8589-efac230f7d5a", "squat", "legs", "barbell", "compound"),
    ("549f800a-c44b-59b1-a2a9-6dfb55546524", "front_squat", "legs", "barbell", "compound"),
    ("01bca2a7-7ad0-5bef-888c-16757ee15eee", "goblet_squat", "legs", "kettlebell", "compound"),
    ("fc0b5c5b-ce0a-5950-a7c0-2c7c35262781", "leg_press", "legs", "machine", "compound"),
    ("1f825c37-7383-551f-a9bc-ee37a50c8e9a", "romanian_deadlift", "legs", "barbell", "compound"),
    ("5b882b56-e2db-5e20-8643-594e8fc3f2db", "lunge", "legs", "dumbbell", "compound"),
    (
        "0aa4e684-74ef-5a94-b49a-4a0163bd554d",
        "bulgarian_split_squat",
        "legs",
        "dumbbell",
        "compound",
    ),
    ("f00db7c8-755a-5551-81a9-af302e86e45c", "hip_thrust", "legs", "barbell", "compound"),
    ("0772bc8f-61ca-595d-92b3-300ea5def436", "leg_extension", "legs", "machine", "isolation"),
    ("9d46a0a1-faef-59ca-9a25-05d62e3fe28b", "leg_curl", "legs", "machine", "isolation"),
    ("e307c2be-4e2e-5c03-9625-a80085c0f67b", "calf_raise", "legs", "machine", "isolation"),
    ("bd7bdef4-a690-53bd-8eca-eb8586580ac3", "overhead_press", "shoulders", "barbell", "compound"),
    (
        "1895caa7-5999-5410-8b4e-1c1b81e74620",
        "dumbbell_shoulder_press",
        "shoulders",
        "dumbbell",
        "compound",
    ),
    ("8fca59e5-e784-56b4-9459-7b0905d6cabf", "arnold_press", "shoulders", "dumbbell", "compound"),
    ("8cf231f0-81a3-5f29-91d5-9b265534a1dc", "upright_row", "shoulders", "barbell", "compound"),
    ("aee9520e-c0b9-541d-aad0-c18a66d8b550", "lateral_raise", "shoulders", "dumbbell", "isolation"),
    ("d02e4e41-c346-54e4-9d59-3fb43cebecd8", "front_raise", "shoulders", "dumbbell", "isolation"),
    ("bb3ce6ce-95bb-5de1-8973-4fc5ab3f55c7", "rear_delt_fly", "shoulders", "dumbbell", "isolation"),
    ("6e900303-596e-5738-8ce7-34f43cb4be2e", "barbell_curl", "arms", "barbell", "isolation"),
    ("f5229c5f-e939-5a3e-9a7d-64c08582a715", "dumbbell_curl", "arms", "dumbbell", "isolation"),
    ("c8808278-8927-5dcf-9bf8-7e5e56281d15", "hammer_curl", "arms", "dumbbell", "isolation"),
    ("8b687ec6-b13f-57f0-9406-3b9ea68099d7", "cable_curl", "arms", "cable", "isolation"),
    ("58100ca2-07cb-5879-99cf-18d6811f2349", "tricep_pushdown", "arms", "cable", "isolation"),
    ("8cf3533f-20f6-506d-adda-ed2c45ec9c2d", "skull_crusher", "arms", "barbell", "isolation"),
    (
        "821df236-4908-5ce3-a850-df656e0ef7d0",
        "overhead_tricep_extension",
        "arms",
        "dumbbell",
        "isolation",
    ),
    ("575c29b9-b718-5d13-ab0f-d527ea7ca600", "crunch", "core", "bodyweight", "isolation"),
    ("2490ce02-8a28-56d3-8cff-5670321b3e86", "cable_crunch", "core", "cable", "isolation"),
    (
        "5009f906-8c15-5025-a855-5ddd814bd450",
        "hanging_leg_raise",
        "core",
        "bodyweight",
        "isolation",
    ),
    ("96891b3a-c511-5ea4-b8c5-cabd6f80127b", "russian_twist", "core", "bodyweight", "isolation"),
    ("224c3d58-8f99-5352-ac32-ef67ad0c14e3", "ab_wheel_rollout", "core", "other", "isolation"),
    (
        "d5b76e94-7b34-590c-b190-c185d1b4f96e",
        "kettlebell_swing",
        "full_body",
        "kettlebell",
        "compound",
    ),
    ("06be491c-9f1a-5787-b474-da6de3fbe6fd", "clean_and_press", "full_body", "barbell", "compound"),
    ("a73f8412-00cb-5768-8efe-34d8499a890c", "burpee", "full_body", "bodyweight", "compound"),
]


def upgrade() -> None:
    op.create_table(
        "exercise",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("key", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("muscle_group", sa.String(), nullable=False),
        sa.Column("equipment", sa.String(), nullable=False),
        sa.Column("mechanic", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "equipment IN ('barbell', 'dumbbell', 'machine', 'cable', 'kettlebell',"
            " 'bodyweight', 'band', 'other')",
            name=op.f("ck_exercise_equipment"),
        ),
        sa.CheckConstraint(
            "mechanic IN ('compound', 'isolation')", name=op.f("ck_exercise_mechanic")
        ),
        sa.CheckConstraint(
            "muscle_group IN ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body')",
            name=op.f("ck_exercise_muscle_group"),
        ),
        sa.CheckConstraint(
            "(user_id IS NULL AND key IS NOT NULL AND name IS NULL)"
            " OR (user_id IS NOT NULL AND key IS NULL AND name IS NOT NULL)",
            name=op.f("ck_exercise_builtin_or_custom"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_exercise_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exercise")),
        sa.UniqueConstraint("key", name=op.f("uq_exercise_key")),
    )
    op.create_index(op.f("ix_exercise_user_id"), "exercise", ["user_id"])
    exercise = sa.table(
        "exercise",
        sa.column("id", sa.Uuid()),
        sa.column("key", sa.String()),
        sa.column("muscle_group", sa.String()),
        sa.column("equipment", sa.String()),
        sa.column("mechanic", sa.String()),
    )
    op.bulk_insert(
        exercise,
        [
            {
                "id": UUID(id_),
                "key": key,
                "muscle_group": group,
                "equipment": equipment,
                "mechanic": mechanic,
            }
            for id_, key, group, equipment, mechanic in CATALOG
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_exercise_user_id"), table_name="exercise")
    op.drop_table("exercise")
