package org.apache.ambari.server.topology;

import org.apache.ambari.server.orm.entities.KerberosDescriptorEntity;

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 * <p/>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p/>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
public class KerberosDescriptorImpl implements KerberosDescriptor {

    private final String name;

    private final String descriptor;


    public KerberosDescriptorImpl(String name, String descriptor) {
        this.name = name;
        this.descriptor = descriptor;
    }

    @Override
    public String getName() {
        return name;
    }

    public String getDescriptor() {
        return descriptor;
    }

    @Override
    public KerberosDescriptorEntity toEntity() {
        KerberosDescriptorEntity entity = new KerberosDescriptorEntity();
        entity.setName(getName());
        entity.setKerberosDescriptorText(getDescriptor());
        return entity;
    }
}
