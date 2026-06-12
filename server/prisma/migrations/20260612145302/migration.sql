-- CreateTable
CREATE TABLE "whatsapp_instances" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "instance_name" TEXT NOT NULL,
    "instance_id" TEXT,
    "phone_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "qr_code" TEXT,
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instances_tenant_id_instance_name_key" ON "whatsapp_instances"("tenant_id", "instance_name");

-- AddForeignKey
ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
